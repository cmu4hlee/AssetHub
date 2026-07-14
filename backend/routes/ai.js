/**
 * @swagger
 * /api/ai/chat/completions:
 *   post:
 *     summary: AI对话补全
 *     description: 通过AI网关或OpenCode进行对话补全
 *     tags: [AI服务]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 description: 消息列表
 *               model:
 *                 type: string
 *                 description: 模型名称
 *               stream:
 *                 type: boolean
 *                 description: 是否流式响应
 *               temperature:
 *                 type: number
 *               max_tokens:
 *                 type: integer
 *               session_id:
 *                 type: string
 *               client_request_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 请求错误
 *       500:
 *         description: 服务器错误
 *       502:
 *         description: AI服务错误
 *       503:
 *         description: 服务不可用
 */

/**
 * @swagger
 * /api/ai/config:
 *   get:
 *     summary: 获取AI配置信息
 *     tags: [AI服务]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     defaultModel:
 *                       type: string
 *                     defaultProvider:
 *                       type: string
 *                     providers:
 *                       type: object
 */

const express = require('express');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const gatewayAIService = require('../services/gateway-ai-service');
const opencodeService = require('../services/opencode-service');

const router = express.Router();
const DEFAULT_AI_MODEL = process.env.DEFAULT_AI_MODEL || 'openclaw';
const USE_OPENCODE = process.env.USE_OPENCODE_FOR_COMPLETIONS !== 'false';
const ALLOW_GATEWAY_FALLBACK_FROM_OPENCODE =
  process.env.OPENCODE_GATEWAY_FALLBACK_TO_CLAUDE === 'true';
const OPENCODE_STREAMING_ENABLED = process.env.OPENCODE_STREAMING_ENABLED === 'true';
const REQUEST_CACHE_TTL_MS = parseInt(process.env.AI_REQUEST_CACHE_TTL_MS, 10) || 3 * 60 * 1000;
const REQUEST_PENDING_TTL_MS =
  parseInt(process.env.AI_REQUEST_PENDING_TTL_MS, 10) || 2 * 60 * 1000;
const GATEWAY_RETRIES = Math.max(1, parseInt(process.env.AI_GATEWAY_RETRIES || '1', 10));
const GATEWAY_RETRY_INTERVAL_MS = Math.max(
  0,
  parseInt(process.env.AI_GATEWAY_RETRY_INTERVAL_MS || '800', 10),
);
const AI_TRACE_LOG_ENABLED = process.env.AI_TRACE_LOG_ENABLED === 'true';
const requestStore = new Map();

const traceLog = (...args) => {
  if (AI_TRACE_LOG_ENABLED) {
    console.log(...args);
  }
};

const pickOptional = (source, key) => {
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }
  return undefined;
};

const compactObject = source =>
  Object.entries(source).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});

const normalizeModelName = value => String(value || '').trim().toLowerCase();
const OPENCLAW_SKILL_NAME = 'assethub';
const OPENCLAW_SKILL_FALLBACK = 'assetclaw';

const getGatewayProviderForModel = model => gatewayAIService.getProviderForModel(normalizeModelName(model));

const shouldUseGatewayForModel = model => Boolean(getGatewayProviderForModel(model));

const cleanupRequestStore = () => {
  const now = Date.now();
  for (const [key, entry] of requestStore.entries()) {
    if (!entry) {
      requestStore.delete(key);
      continue;
    }

    if (entry.status === 'pending') {
      if (now - entry.createdAt > REQUEST_PENDING_TTL_MS) {
        requestStore.delete(key);
      }
      continue;
    }

    if (now - entry.createdAt > REQUEST_CACHE_TTL_MS) {
      requestStore.delete(key);
    }
  }
};

const buildDedupKey = ({ userId, traceId, requestId, sessionId, model, messages }) => {
  if (requestId) {
    return `req:${userId}:${requestId}`;
  }

  const digest = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        traceId,
        sessionId,
        model,
        messages,
      }),
    )
    .digest('hex');
  return `trace:${userId}:${digest}`;
};

const createProxyResult = async ({ payload, traceId, tenantId, userId, authContext }) => {
  const requestedModel = payload.model || DEFAULT_AI_MODEL;
  const requestedGatewayProvider = gatewayAIService.resolveProvider(requestedModel);
  const shouldUseOpenCode = !shouldUseGatewayForModel(requestedModel);

  if (shouldUseOpenCode) {
    if (!USE_OPENCODE || !opencodeService.isAvailable()) {
      return {
        ok: false,
        status: 503,
        body: {
          success: false,
          message: '本地 OpenCode 网关未启用，请确认 OPENCODE_SERVER_ENABLED / USE_OPENCODE_FOR_COMPLETIONS 配置',
          provider: 'opencode',
        },
      };
    }

    try {
      const result = await opencodeService.createChatCompletion(
        payload,
        tenantId,
        userId,
        authContext,
      );
      if (result.success) {
        traceLog(
          `[AI Trace:${traceId}] OpenCode 响应成功, 文本长度=${result.data?.choices?.[0]?.message?.content?.length || 0}`,
        );
        return {
          ok: true,
          status: 200,
          body: result.data,
        };
      }

      traceLog(`[AI Trace:${traceId}] OpenCode 失败: ${result.error || '未知错误'}`);
      if (!ALLOW_GATEWAY_FALLBACK_FROM_OPENCODE) {
        return {
          ok: false,
          status: 502,
          body: {
            success: false,
            message: result.error || 'OpenCode 请求失败',
            ...(result.detail ? { detail: result.detail } : {}),
            provider: 'opencode',
          },
        };
      }

      traceLog(
        `[AI Trace:${traceId}] OpenCode 失败后按配置回退到 gateway provider=${requestedGatewayProvider}`,
      );
    } catch (error) {
      traceLog(`[AI Trace:${traceId}] OpenCode 调用异常: ${error.message}`);
      if (!ALLOW_GATEWAY_FALLBACK_FROM_OPENCODE) {
        return {
          ok: false,
          status: 502,
          body: {
            success: false,
            message: error.message || 'OpenCode 调用异常',
            provider: 'opencode',
          },
        };
      }

      traceLog(
        `[AI Trace:${traceId}] OpenCode 调用异常后按配置回退到 gateway provider=${requestedGatewayProvider}`,
      );
    }
  }

  let result = null;
  try {
    result = await gatewayAIService.createChatCompletion(
      payload,
      GATEWAY_RETRIES,
      GATEWAY_RETRY_INTERVAL_MS,
    );
  } catch (error) {
    console.error(`[AI Trace:${traceId}] Gateway 调用异常 provider=${requestedGatewayProvider}:`, error);
    return {
      ok: false,
      status: 502,
      body: {
        success: false,
        message: error.message || `${requestedGatewayProvider} 调用异常`,
      },
    };
  }
  if (!result.success) {
    console.error(
      `[AI Trace:${traceId}] Gateway 失败 provider=${requestedGatewayProvider}: ${result.error || '未知错误'}`,
    );
    return {
      ok: false,
      status: 502,
      body: {
        success: false,
        message: result.error || 'AI请求失败',
        ...(result.detail ? { detail: result.detail } : {}),
      },
    };
  }

  const normalizedReply = gatewayAIService.normalizeReply(result.data);
  if (!normalizedReply) {
    traceLog(`[AI Trace:${traceId}] 响应为空或无法归一化`);
    return {
      ok: false,
      status: 502,
      body: {
        success: false,
        message: 'AI返回空内容',
        detail: result.data || null,
      },
    };
  }

  const raw = result.data && typeof result.data === 'object' ? result.data : {};
  const normalizedResponse = {
    ...raw,
    id: raw.id || `chatcmpl_proxy_${Date.now()}`,
    object: raw.object || 'chat.completion',
    created: raw.created || Math.floor(Date.now() / 1000),
    model: raw.model || payload.model || DEFAULT_AI_MODEL,
    choices:
      Array.isArray(raw.choices) && raw.choices.length > 0
        ? raw.choices.map((choice, index) => {
            const messageObj =
              choice?.message && typeof choice.message === 'object'
                ? choice.message
                : { role: 'assistant' };
            return {
              ...choice,
              index: Number.isInteger(choice?.index) ? choice.index : index,
              message: {
                ...messageObj,
                role: messageObj.role || 'assistant',
                content: index === 0 ? normalizedReply : gatewayAIService.normalizeReply(choice) || '',
              },
            };
          })
        : [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: normalizedReply,
              },
              finish_reason: 'stop',
            },
          ],
  };

  traceLog(`[AI Trace:${traceId}] Gateway 响应成功, 文本长度=${normalizedReply.length}`);
  return {
    ok: true,
    status: 200,
    body: normalizedResponse,
  };
};

const sendProxyResult = (res, traceId, proxyResult, deduplicated = '') => {
  res.setHeader('X-AI-Trace-ID', traceId);
  if (deduplicated) {
    res.setHeader('X-AI-Deduplicated', deduplicated);
  }

  if (proxyResult.ok) {
    return res.json(proxyResult.body);
  }
  return res.status(proxyResult.status).json(proxyResult.body);
};

const handleChatCompletions = async (req, res) => {
  const traceId =
    req.header('X-AI-Trace-ID') || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    cleanupRequestStore();

    const userId = String(req.user?.id || req.user?.userId || req.user?.username || 'anonymous');
    const tenantId = req.user?.tenant_id || null;
    const authContext = {
      authHeader: req.header('Authorization') || null,
      tenantId,
      userId,
      username: req.user?.username || null,
      realName: req.user?.real_name || null,
      role: req.user?.role || null,
      tenantName: req.user?.tenant_name || null,
      departmentCode: req.user?.department_code || null,
      managedDepartments: Array.isArray(req.user?.managed_departments)
        ? req.user.managed_departments
        : [],
      enabledModules: Array.isArray(req.user?.enabled_modules) ? req.user.enabled_modules : [],
      isSuperAdmin: req.user?.is_super_admin === true,
    };
    const body = req.body || {};
    const sessionId = String(body.session_id || req.header('X-AI-Session-ID') || '').trim();
    const requestId = String(body.client_request_id || req.header('X-AI-Request-ID') || '').trim();
    const sanitizedMessages = gatewayAIService.sanitizeMessages(body.messages);
    const requestedModel = body.model || DEFAULT_AI_MODEL;
    const requestedGatewayProvider = getGatewayProviderForModel(requestedModel);
    const basePayload = {
      model: requestedModel,
      messages: sanitizedMessages,
      stream: body.stream === true,
      temperature: pickOptional(body, 'temperature'),
      top_p: pickOptional(body, 'top_p'),
      max_tokens: pickOptional(body, 'max_tokens'),
      presence_penalty: pickOptional(body, 'presence_penalty'),
      frequency_penalty: pickOptional(body, 'frequency_penalty'),
      stop: pickOptional(body, 'stop'),
      session_id: sessionId || undefined,
      conversation_id: sessionId || undefined,
      openclaw_username: pickOptional(body, 'openclaw_username'),
      openclaw_password: pickOptional(body, 'openclaw_password'),
      openclaw_auth: pickOptional(body, 'openclaw_auth'),
      user: req.user?.username || undefined,
      auth_context: compactObject({
        auth_header: authContext.authHeader || undefined,
        tenant_id: authContext.tenantId,
        user_id: authContext.userId,
        username: authContext.username || undefined,
        real_name: authContext.realName || undefined,
        role: authContext.role || undefined,
        tenant_name: authContext.tenantName || undefined,
        department_code: authContext.departmentCode || undefined,
        managed_departments: authContext.managedDepartments,
        enabled_modules: authContext.enabledModules,
        is_super_admin: authContext.isSuperAdmin === true ? true : undefined,
      }),
      metadata: compactObject({
        ...(typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}),
        assistant_skill: body.metadata?.assistant_skill || OPENCLAW_SKILL_NAME,
        assistant_skill_fallback:
          body.metadata?.assistant_skill_fallback || OPENCLAW_SKILL_FALLBACK,
        client_trace_id: traceId,
        client_request_id: requestId || undefined,
        client_session_id: sessionId || undefined,
        user_id: userId,
        tenant_id: tenantId,
        username: req.user?.username,
        real_name: req.user?.real_name,
        role: req.user?.role,
        tenant_name: req.user?.tenant_name,
        department_code: req.user?.department_code,
        managed_departments: authContext.managedDepartments,
        enabled_modules: authContext.enabledModules,
        is_super_admin: authContext.isSuperAdmin === true ? true : undefined,
      }),
    };

    if (basePayload.messages.length === 0) {
      traceLog(`[AI Trace:${traceId}] 请求拒绝: messages为空`);
      return sendProxyResult(
        res,
        traceId,
        {
          ok: false,
          status: 400,
          body: {
            success: false,
            message: 'messages不能为空',
          },
        },
        '',
      );
    }

    const isOpenCodeStreaming =
      basePayload.stream === true &&
      OPENCODE_STREAMING_ENABLED &&
      opencodeService.isAvailable() &&
      !shouldUseGatewayForModel(requestedModel);
    const isGatewayStreaming =
      basePayload.stream === true && requestedGatewayProvider === 'openclaw';

    if (isOpenCodeStreaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-AI-Trace-ID', traceId);

      try {
        const streamController = opencodeService.createStreamingChatCompletion(
          { ...body, messages: sanitizedMessages },
          tenantId,
          userId,
          authContext,
        );

        // Start streaming asynchronously
        streamController.start();

        // Wait for stream to complete and send result
        const checkStream = setInterval(() => {
          if (streamController.isFinished()) {
            clearInterval(checkStream);
            const error = streamController.getError();
            if (error) {
              res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            } else {
              const content = streamController.getFullContent();
              res.write(`data: ${JSON.stringify({
                id: `chatcmpl_opencode_${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: body.model || DEFAULT_AI_MODEL,
                choices: [{
                  index: 0,
                  message: { role: 'assistant', content },
                  finish_reason: 'stop',
                }],
              })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
          }
        }, 100);

        // Handle client disconnect
        req.on('close', () => {
          clearInterval(checkStream);
        });

        return;
      } catch (error) {
        console.error(`[AI Trace:${traceId}] OpenCode 流式调用异常:`, error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }

    if (isGatewayStreaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-AI-Trace-ID', traceId);

      try {
        const streamResult = await gatewayAIService.createStreamingChatCompletion(basePayload);
        if (!streamResult.success || !streamResult.stream) {
          const errorPayload = {
            success: false,
            message: streamResult.error || 'OpenClaw 流式调用失败',
            ...(streamResult.detail ? { detail: streamResult.detail } : {}),
          };
          res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        const upstreamStream = streamResult.stream;
        const closeUpstream = () => {
          if (typeof upstreamStream?.destroy === 'function') {
            upstreamStream.destroy();
          }
        };

        req.on('close', closeUpstream);

        upstreamStream.on('data', chunk => {
          if (!res.writableEnded) {
            res.write(chunk);
          }
        });

        upstreamStream.on('end', () => {
          req.off?.('close', closeUpstream);
          if (!res.writableEnded) {
            res.end();
          }
        });

        upstreamStream.on('error', error => {
          req.off?.('close', closeUpstream);
          console.error(`[AI Trace:${traceId}] OpenClaw 流式调用异常:`, error);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: error.message || 'OpenClaw 流式调用失败' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
        });

        return;
      } catch (error) {
        console.error(`[AI Trace:${traceId}] OpenClaw 流式调用异常:`, error);
        res.write(`data: ${JSON.stringify({ error: error.message || 'OpenClaw 流式调用失败' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }

    const dedupKey = buildDedupKey({
      userId,
      traceId,
      requestId,
      sessionId,
      model: requestedModel,
      messages: sanitizedMessages,
    });

    traceLog(
      `[AI Trace:${traceId}] 收到对话请求 session=${sessionId || '-'} request=${requestId || '-'} key=${dedupKey}`,
    );

    const existingEntry = requestStore.get(dedupKey);
    if (existingEntry) {
      if (existingEntry.status === 'pending' && existingEntry.promise) {
        traceLog(`[AI Trace:${traceId}] 命中进行中请求，复用执行结果`);
        const proxyResult = await existingEntry.promise;
        return sendProxyResult(res, traceId, proxyResult, 'inflight');
      }

      if (existingEntry.proxyResult) {
        traceLog(`[AI Trace:${traceId}] 命中请求缓存，直接返回`);
        return sendProxyResult(res, traceId, existingEntry.proxyResult, 'cache');
      }
    }

    const payload = {
      ...basePayload,
      stream: false,
    };

    const proxyPromise = createProxyResult({
      payload,
      traceId,
      tenantId,
      userId,
      authContext,
    });
    requestStore.set(dedupKey, {
      status: 'pending',
      createdAt: Date.now(),
      promise: proxyPromise,
    });

    const proxyResult = await proxyPromise;
    requestStore.set(dedupKey, {
      status: 'done',
      createdAt: Date.now(),
      proxyResult,
    });

    return sendProxyResult(res, traceId, proxyResult, '');
  } catch (error) {
    console.error(`[AI Trace:${traceId}] AI对话代理调用失败:`, error);
    return sendProxyResult(res, traceId, {
      ok: false,
      status: 500,
      body: {
        success: false,
        message: error.message || 'AI对话代理调用失败',
      },
    });
  }
};

router.post('/chat/completions', authenticate, handleChatCompletions);
// 兼容历史前端路径：/api/chat/completions（挂载在 /api/chat 时生效）
router.post('/completions', authenticate, handleChatCompletions);

router.get('/config', authenticate, (req, res) => {
  const defaultGatewayProvider = getGatewayProviderForModel(DEFAULT_AI_MODEL);
  return res.json({
    success: true,
    data: {
      defaultModel: DEFAULT_AI_MODEL,
      defaultProvider: defaultGatewayProvider || 'opencode',
      providers: {
        opencode: opencodeService.getConfig(),
        gateway: gatewayAIService.getConfig(),
      },
    },
  });
});

module.exports = router;
