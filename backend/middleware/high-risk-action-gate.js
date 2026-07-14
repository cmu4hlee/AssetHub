const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { logAudit } = require('./auditLogger');

const HIGH_RISK_GATE_ENABLED = process.env.HIGH_RISK_GATE_ENABLED !== 'false';
const HIGH_RISK_CONFIRM_TTL_MS = Number.parseInt(process.env.HIGH_RISK_CONFIRM_TTL_MS || '300000', 10);
const HIGH_RISK_IDEMPOTENCY_TTL_HOURS = Number.parseInt(
  process.env.HIGH_RISK_IDEMPOTENCY_TTL_HOURS || '24',
  10,
);
const CONFIRM_SECRET = String(process.env.HIGH_RISK_CONFIRM_SECRET || process.env.JWT_SECRET || '').trim();

const HIGH_RISK_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ALWAYS_HIGH_RISK_METHODS = new Set(['PUT', 'PATCH', 'DELETE']);
const HIGH_RISK_PREFIXES = [
  '/api/assets',
  '/api/inventory',
  '/api/inventory-plans',
  '/api/inventory-tasks',
  '/api/inventory-discrepancies',
  '/api/transfer',
  '/api/idle',
  '/api/departments',
  '/api/maintenance',
  '/api/barcode-scan',
  '/api/asset-location',
  '/api/iot-devices',
  '/api/location-alerts',
  '/api/iot',
  '/api/technical-documents',
  '/api/audit-logs',
  '/api/acceptance',
  '/api/procurement',
  '/api/quality-control',
  '/api/quality',
  '/api/depreciation',
  '/api/asset-depreciation',
  '/api/scrapping',
  '/api/api-documentation',
  '/api/cloud-sync',
  '/api/backup',
  '/api/users',
  '/api/roles-permissions',
  '/api/enhanced-permissions',
  '/api/system-config',
  '/api/workflow',
  '/api/compliance',
  '/api/risk',
  '/api/staff',
  '/api/uptime',
  '/api/tenant-module-config',
  '/api/module-configs',
  '/api/modules',
  '/api/menus',
  '/api/asset-labels',
  '/api/temp-assets',
  '/api/location-codes',
  '/api/tenants',
  '/api/adverse-reaction',
  '/api/adverse-events',
];

const SAFE_EXACT_PATHS = new Set([
  '/api/health',
  '/api/health/dependencies',
  '/api/users/login',
  '/api/users/register',
  '/api/users/refresh-token',
  '/api/iot/patient-volume/ingest',
  '/api/iot/patient-volume/ingest/batch',
  // 人员资质模块完全放行
  '/api/staff/qualifications',
  '/api/staff/training-records',
  '/api/staff/assessments',
]);

const SAFE_PREFIX_PATHS = [
  '/api/maintenance/ai',
  '/api/technical-documents/ai',
  '/api/asset-ai-analysis',
  // 人员资质管理模块 - 允许正常的CRUD操作
  '/api/staff/qualifications',
  '/api/staff/training-records',
  '/api/staff/assessments',
  '/api/staff',
  // 特种设备管理 - 允许正常的CRUD操作
  '/api/compliance/special-equipment',
  '/api/compliance/special-equipment/inspections',
  // 计量附件管理（上传/列表/下载/删除 - 跟 maintenance/logs 附件一致）
  '/api/quality-control/metrology/attachments',
];

const READ_ONLY_POST_PATTERNS = [
  /^\/api\/analysis(\/|$)/,
  /^\/api\/dashboard(\/|$)/,
  /^\/api\/backup\/restore\/preview(\/|$)/,
  // 登录链路与权限校验等查询型 POST，不属于新增/更新/删除/审批
  /^\/api\/tenants\/verify(\/|$)/,
  /^\/api\/roles-permissions\/user\/check-permission(\/|$)/,
  /^\/api\/tenant-module-config\/modules\/[^/]+\/check-dependencies(\/|$)/,
  /^\/api\/(?:asset-)?depreciation\/(?:depreciation\/)?calculate(\/|$)/,
  // 资产图片上传 - multipart/form-data 无法稳定 hash，已有 authenticate + fileSecurity + multer 限制
  /^\/api\/assets\/[^/]+\/images(\/|$)/,
  // 其它 multipart/form-data 上传路由 - 同样因 FormData 无法稳定 hash 而豁免
  /^\/api\/maintenance\/logs\/[^/]+\/attachments(\/|$)/,
  /^\/api\/maintenance\/requests\/[^/]+\/attachments(\/|$)/,
  /^\/api\/maintenance\/workorders\/[^/]+\/attachments(\/|$)/,
  /^\/api\/maintenance\/requests\/[^/]+\/attachments\/[^/]+\/download(\/|$)/,
  /^\/api\/assets\/import(\/|$)/,
  /^\/api\/assets\/legacy\/import(\/|$)/,
  /^\/api\/scrapping\/[^/]+\/files(\/|$)/,
  /^\/api\/adverse-reaction\/[^/]+\/attachments(\/|$)/,
  /^\/api\/adverse-events\/[^/]+\/attachments(\/|$)/,
  /^\/api\/acceptance\/records\/[^/]+\/files(\/|$)/,
  /^\/api\/procurement\/(?:requests\/)?[^/]+\/files(\/|$)/,
  /^\/api\/quality-control\/metrology\/(?:analyze-report|from-file)(\/|$)/,
  /^\/api\/quality-control\/metrology\/[^/]+\/attachments(\/|$)/,
  /^\/api\/quality-control\/metrology\/attachments\/[^/]+(\/|$)/,
  // 技术资料上传 - multipart/form-data 无法稳定 hash，已有 authenticate + fileSecurity + multer 限制
  /^\/api\/technical-documents$/,
  /^\/api\/technical-documents\/upload\/[^/]+(\/|$)/,
  /^\/api\/.*\/(verify|validate|check|preview|calculate|summary|search|query|stats|health-check)(\/|$)/i,
];

const APPROVAL_KEYWORD_PATTERN = /approve|approval|reject|审核|审批|通过|驳回/i;
const IDEMPOTENCY_TABLE_NAME = 'high_risk_action_idempotency';

let tableReadyPromise = null;

const toBase64Url = value => Buffer.from(value).toString('base64url');

const parseConfirmTokenPayload = token => {
  if (!token || typeof token !== 'string') return null;
  const [encodedPayload] = token.split('.');
  if (!encodedPayload) return null;
  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (error) {
    return null;
  }
};

const safeJsonParse = value => {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (error) {
    return null;
  }
};

const normalizeTenantId = value => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const normalizePath = req => {
  const fullPath = `${req.baseUrl || ''}${req.path || ''}` || req.originalUrl || '';
  const pathname = fullPath.split('?')[0] || '/';
  return pathname.replace(/\/+$/, '') || '/';
};

const hashContent = value => crypto.createHash('sha256').update(String(value)).digest('hex');

const stableStringify = value => {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`;

  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const sanitizeRequestForHash = req => ({
  method: String(req.method || '').toUpperCase(),
  path: normalizePath(req),
  query: req.query || {},
  params: req.params || {},
  body: req.body || {},
});

const inferActionType = req => {
  const method = String(req.method || '').toUpperCase();
  const path = normalizePath(req);
  if (APPROVAL_KEYWORD_PATTERN.test(path)) {
    return /reject|驳回/i.test(path) ? 'reject' : 'approve';
  }
  if (method === 'POST') return 'create';
  if (method === 'DELETE') return 'delete';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  return 'update';
};

const inferModule = req => {
  const path = normalizePath(req);
  const segments = path.split('/').filter(Boolean);
  return segments[1] || 'unknown';
};

const isSafePath = path => {
  if (SAFE_EXACT_PATHS.has(path)) return true;
  return SAFE_PREFIX_PATHS.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
};

const matchesHighRiskPrefix = path =>
  HIGH_RISK_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));

const isHighRiskRequest = req => {
  if (!HIGH_RISK_GATE_ENABLED) return false;
  const method = String(req.method || '').toUpperCase();
  if (!HIGH_RISK_METHODS.has(method)) return false;

  const path = normalizePath(req);
  if (isSafePath(path)) return false;
  if (method === 'POST' && READ_ONLY_POST_PATTERNS.some(pattern => pattern.test(path))) return false;

  if (ALWAYS_HIGH_RISK_METHODS.has(method)) {
    return matchesHighRiskPrefix(path) || APPROVAL_KEYWORD_PATTERN.test(path);
  }

  return matchesHighRiskPrefix(path) || APPROVAL_KEYWORD_PATTERN.test(path);
};

const normalizeIdempotencyKey = req => {
  const value = req.get('Idempotency-Key') || req.get('X-Idempotency-Key');
  if (!value) return '';
  return String(value).trim();
};

const parseBearerToken = req => {
  const authHeader = req.get('Authorization');
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) return '';
  return authHeader.replace(/^Bearer\s+/i, '').trim();
};

const resolveActor = req => {
  const userIdFromReq = Number.parseInt(String(req.user?.id || ''), 10);
  const tenantIdFromReq = normalizeTenantId(req.user?.tenant_id || req.headers['x-tenant-id']);
  if (Number.isInteger(userIdFromReq) && userIdFromReq > 0) {
    return {
      userId: userIdFromReq,
      username: req.user?.username || '',
      role: req.user?.role || '',
      tenantId: tenantIdFromReq,
      actorKey: `user:${userIdFromReq}`,
      injected: false,
    };
  }

  const token = parseBearerToken(req);
  if (!token || !CONFIRM_SECRET) return null;

  try {
    const decoded = jwt.verify(token, CONFIRM_SECRET);
    const tokenUserId = Number.parseInt(String(decoded?.userId || ''), 10);
    const tenantId = normalizeTenantId(decoded?.tenant_id || req.headers['x-tenant-id']);
    const actorKey = Number.isInteger(tokenUserId) && tokenUserId > 0
      ? `user:${tokenUserId}`
      : `token:${hashContent(token).slice(0, 16)}`;

    if (!req.user) {
      req.user = {
        id: Number.isInteger(tokenUserId) && tokenUserId > 0 ? tokenUserId : null,
        username: decoded?.username || null,
        role: decoded?.role || null,
        tenant_id: tenantId || null,
      };
    }

    return {
      userId: Number.isInteger(tokenUserId) && tokenUserId > 0 ? tokenUserId : null,
      username: decoded?.username || '',
      role: decoded?.role || '',
      tenantId,
      actorKey,
      injected: true,
    };
  } catch (error) {
    return null;
  }
};

const createActionId = () => `hra_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

const buildConfirmationPayload = ({
  actionId,
  method,
  path,
  actionFingerprint,
  requestHash,
  idempotencyKey,
  actorKey,
  tenantId,
}) => {
  const issuedAt = Date.now();
  return {
    aid: actionId,
    m: method,
    p: path,
    fp: actionFingerprint,
    rh: requestHash,
    ik: idempotencyKey,
    ak: actorKey,
    t: tenantId,
    iat: issuedAt,
    exp: issuedAt + HIGH_RISK_CONFIRM_TTL_MS,
  };
};

const signConfirmationPayload = payload => {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', CONFIRM_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
};

const verifyConfirmationToken = (token, expectedPayload) => {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing' };
  }
  if (!CONFIRM_SECRET) {
    return { ok: false, reason: 'secret_not_ready' };
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return { ok: false, reason: 'malformed' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', CONFIRM_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (expectedSignature !== signature) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  try {
    const decoded = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object') {
      return { ok: false, reason: 'payload_invalid' };
    }
    if (Number(decoded.exp || 0) < Date.now()) {
      return { ok: false, reason: 'expired' };
    }

    const checks = [
      ['aid', expectedPayload.actionId],
      ['m', expectedPayload.method],
      ['p', expectedPayload.path],
      ['fp', expectedPayload.actionFingerprint],
      ['rh', expectedPayload.requestHash],
      ['ik', expectedPayload.idempotencyKey],
      ['ak', expectedPayload.actorKey],
      ['t', expectedPayload.tenantId],
    ];

    for (const [key, value] of checks) {
      if (String(decoded[key] || '') !== String(value || '')) {
        return { ok: false, reason: `payload_mismatch:${key}` };
      }
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'payload_parse_failed' };
  }
};

const ensureIdempotencyTable = async () => {
  if (tableReadyPromise) {
    return tableReadyPromise;
  }

  tableReadyPromise = (async () => {
    try {
      // MySQL 5.5 不支持 DATETIME DEFAULT CURRENT_TIMESTAMP，因此改为显式写入时间字段。
      await db.execute(
        `CREATE TABLE IF NOT EXISTS ${IDEMPOTENCY_TABLE_NAME} (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL DEFAULT 0,
          actor_key VARCHAR(128) NOT NULL,
          idempotency_key VARCHAR(128) NOT NULL,
          action_id VARCHAR(64) NOT NULL,
          action_fingerprint VARCHAR(255) NOT NULL,
          request_hash CHAR(64) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'processing',
          response_status INT NULL,
          response_body MEDIUMTEXT NULL,
          error_message TEXT NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          expires_at DATETIME NOT NULL,
          UNIQUE KEY uk_hra_idempotency (tenant_id, actor_key, idempotency_key),
          INDEX idx_hra_expires_at (expires_at),
          INDEX idx_hra_action_id (action_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
    } catch (error) {
      // 建表失败后允许下一次请求重试，避免进程存活期内永久锁死。
      tableReadyPromise = null;
      throw error;
    }
  })();

  return tableReadyPromise;
};

const acquireIdempotency = async ({
  tenantId,
  actorKey,
  idempotencyKey,
  actionId,
  actionFingerprint,
  requestHash,
}) => {
  await ensureIdempotencyTable();

  const expiresAt = new Date(Date.now() + HIGH_RISK_IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
  const expiresAtText = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

  try {
    const [result] = await db.execute(
      `INSERT INTO ${IDEMPOTENCY_TABLE_NAME}
        (tenant_id, actor_key, idempotency_key, action_id, action_fingerprint, request_hash, status, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'processing', NOW(), NOW(), ?)`,
      [tenantId, actorKey, idempotencyKey, actionId, actionFingerprint, requestHash, expiresAtText],
    );

    return {
      state: 'acquired',
      recordId: result?.insertId || null,
    };
  } catch (error) {
    if (error?.code !== 'ER_DUP_ENTRY') {
      throw error;
    }
  }

  const [rows] = await db.execute(
    `SELECT id, tenant_id, actor_key, idempotency_key, action_id, action_fingerprint, request_hash,
            status, response_status, response_body, error_message, expires_at
       FROM ${IDEMPOTENCY_TABLE_NAME}
      WHERE tenant_id = ? AND actor_key = ? AND idempotency_key = ?
      LIMIT 1`,
    [tenantId, actorKey, idempotencyKey],
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return { state: 'unknown' };
  }

  const existing = rows[0];
  const expired = existing.expires_at && new Date(existing.expires_at).getTime() < Date.now();
  if (expired) {
    await db.execute(
      `UPDATE ${IDEMPOTENCY_TABLE_NAME}
          SET action_id = ?, action_fingerprint = ?, request_hash = ?, status = 'processing',
              response_status = NULL, response_body = NULL, error_message = NULL, updated_at = NOW(), expires_at = ?
        WHERE id = ?`,
      [actionId, actionFingerprint, requestHash, expiresAtText, existing.id],
    );
    return { state: 'acquired', recordId: existing.id };
  }

  if (
    String(existing.action_fingerprint || '') !== String(actionFingerprint || '') ||
    String(existing.request_hash || '') !== String(requestHash || '')
  ) {
    return { state: 'conflict_reused_key', existing };
  }

  if (existing.status === 'completed') {
    return { state: 'replay', existing };
  }
  if (existing.status === 'processing') {
    return { state: 'processing', existing };
  }
  if (existing.status === 'failed') {
    return { state: 'failed', existing };
  }
  return { state: 'unknown', existing };
};

const completeIdempotencyRecord = async ({ recordId, statusCode, responseBody, errorMessage }) => {
  if (!recordId) return;
  await ensureIdempotencyTable();

  let serializedBody = null;
  if (responseBody !== undefined) {
    try {
      serializedBody = JSON.stringify(responseBody);
    } catch (error) {
      serializedBody = JSON.stringify({ value: String(responseBody) });
    }
  }

  await db.execute(
    `UPDATE ${IDEMPOTENCY_TABLE_NAME}
        SET status = ?, response_status = ?, response_body = ?, error_message = ?, updated_at = NOW()
      WHERE id = ?`,
    [
      statusCode >= 500 ? 'failed' : 'completed',
      statusCode,
      serializedBody,
      errorMessage || null,
      recordId,
    ],
  );
};

const buildConfirmationResponse = ({ actionId, confirmToken }) => ({
  success: false,
  code: 'HIGH_RISK_CONFIRMATION_REQUIRED',
  message: '高风险操作需要二次确认后才能执行',
  requiresConfirmation: true,
  actionId,
  confirmToken,
  confirmTokenHeader: 'X-Risk-Confirm-Token',
  idempotencyHeader: 'Idempotency-Key',
  expiresInMs: HIGH_RISK_CONFIRM_TTL_MS,
});

const buildActionDescription = (actionType, path) =>
  `高风险动作闸门：${actionType} ${path}`;

const logGateAudit = (req, actionType, moduleName, actionDescription, responseStatus, errorMessage) =>
  logAudit(req, {
    action_type: actionType,
    module: moduleName,
    resource_type: 'high_risk_gate',
    action_description: actionDescription,
    response_status: responseStatus,
    error_message: errorMessage || null,
  }).catch(() => {});

function highRiskActionGate(req, res, next) {
  if (!isHighRiskRequest(req)) {
    return next();
  }

  const method = String(req.method || '').toUpperCase();
  const path = normalizePath(req);
  const actionType = inferActionType(req);
  const moduleName = inferModule(req);

  const actor = resolveActor(req);
  if (!actor) {
    logGateAudit(
      req,
      'reject',
      moduleName,
      buildActionDescription(actionType, path),
      401,
      'actor_unresolved',
    );
    return res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED_FOR_HIGH_RISK_ACTION',
      message: '高风险操作必须在已认证会话下执行',
    });
  }

  if (!CONFIRM_SECRET) {
    logGateAudit(
      req,
      'reject',
      moduleName,
      buildActionDescription(actionType, path),
      503,
      'confirm_secret_not_configured',
    );
    return res.status(503).json({
      success: false,
      code: 'HIGH_RISK_GATE_MISCONFIG',
      message: '高风险动作闸门未完成配置（缺少 HIGH_RISK_CONFIRM_SECRET 或 JWT_SECRET）',
    });
  }

  const idempotencyKey = normalizeIdempotencyKey(req);
  if (!idempotencyKey || idempotencyKey.length > 128) {
    logGateAudit(
      req,
      'reject',
      moduleName,
      buildActionDescription(actionType, path),
      400,
      'missing_or_invalid_idempotency_key',
    );
    return res.status(400).json({
      success: false,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: '高风险操作必须提供 Idempotency-Key 请求头（长度不超过 128）',
    });
  }

  const requestHash = hashContent(stableStringify(sanitizeRequestForHash(req)));
  const actionFingerprint = `${method}:${path}`;
  const incomingConfirmToken = req.get('X-Risk-Confirm-Token') || req.get('X-Confirm-Token');
  const hintedActionId = parseConfirmTokenPayload(incomingConfirmToken)?.aid;
  const actionId = req.get('X-Action-Id') || hintedActionId || createActionId();

  const confirmationPayload = buildConfirmationPayload({
    actionId,
    method,
    path,
    actionFingerprint,
    requestHash,
    idempotencyKey,
    actorKey: actor.actorKey,
    tenantId: actor.tenantId,
  });

  const verifyResult = verifyConfirmationToken(incomingConfirmToken, {
    actionId: confirmationPayload.aid,
    method: confirmationPayload.m,
    path: confirmationPayload.p,
    actionFingerprint: confirmationPayload.fp,
    requestHash: confirmationPayload.rh,
    idempotencyKey: confirmationPayload.ik,
    actorKey: confirmationPayload.ak,
    tenantId: confirmationPayload.t,
  });

  if (!verifyResult.ok) {
    const confirmToken = signConfirmationPayload(confirmationPayload);
    logGateAudit(
      req,
      'reject',
      moduleName,
      buildActionDescription(actionType, path),
      428,
      `confirmation_required:${verifyResult.reason}`,
    );
    res.set('X-Action-Id', actionId);
    return res.status(428).json(buildConfirmationResponse({ actionId, confirmToken }));
  }

  (async () => {
    let acquireResult;
    try {
      acquireResult = await acquireIdempotency({
        tenantId: actor.tenantId,
        actorKey: actor.actorKey,
        idempotencyKey,
        actionId,
        actionFingerprint,
        requestHash,
      });
    } catch (error) {
      logGateAudit(
        req,
        'reject',
        moduleName,
        buildActionDescription(actionType, path),
        500,
        `idempotency_store_error:${error.message}`,
      );
      return res.status(500).json({
        success: false,
        code: 'IDEMPOTENCY_STORE_ERROR',
        message: '幂等控制存储异常，请稍后重试',
      });
    }

    if (acquireResult.state === 'conflict_reused_key') {
      logGateAudit(
        req,
        'reject',
        moduleName,
        buildActionDescription(actionType, path),
        409,
        'idempotency_key_reused_with_different_payload',
      );
      return res.status(409).json({
        success: false,
        code: 'IDEMPOTENCY_KEY_CONFLICT',
        message: '同一个 Idempotency-Key 不能用于不同的操作内容',
      });
    }

    if (acquireResult.state === 'processing') {
      logGateAudit(
        req,
        'reject',
        moduleName,
        buildActionDescription(actionType, path),
        409,
        'idempotency_request_in_progress',
      );
      return res.status(409).json({
        success: false,
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        message: '同幂等键请求正在处理中，请稍后重试',
      });
    }

    if (acquireResult.state === 'replay' || acquireResult.state === 'failed') {
      const replayStatus = Number.parseInt(String(acquireResult.existing?.response_status || 200), 10) || 200;
      const replayBody = safeJsonParse(acquireResult.existing?.response_body);
      const replayPayload =
        replayBody && typeof replayBody === 'object'
          ? { ...replayBody, idempotentReplay: true }
          : {
              success: replayStatus < 400,
              idempotentReplay: true,
              data: replayBody,
            };

      logGateAudit(
        req,
        'view',
        moduleName,
        buildActionDescription(actionType, path),
        replayStatus,
        'idempotent_replay',
      );
      res.set('X-Action-Id', acquireResult.existing?.action_id || actionId);
      res.set('X-Idempotent-Replay', 'true');
      return res.status(replayStatus).json(replayPayload);
    }

    if (acquireResult.state !== 'acquired') {
      logGateAudit(
        req,
        'reject',
        moduleName,
        buildActionDescription(actionType, path),
        500,
        `idempotency_unknown_state:${acquireResult.state}`,
      );
      return res.status(500).json({
        success: false,
        code: 'IDEMPOTENCY_ACQUIRE_FAILED',
        message: '幂等控制失败，请稍后重试',
      });
    }

    const {recordId} = acquireResult;
    const gateStartTime = Date.now();
    let responseBody;
    let finalized = false;

    const finalize = async () => {
      if (finalized) return;
      finalized = true;

      const statusCode = res.statusCode || 500;
      const executionTime = Date.now() - gateStartTime;
      const errorMessage =
        statusCode >= 400
          ? (responseBody && typeof responseBody === 'object' ? responseBody.message || null : null)
          : null;

      await completeIdempotencyRecord({
        recordId,
        statusCode,
        responseBody,
        errorMessage,
      });

      await logAudit(req, {
        action_type: actionType,
        module: moduleName,
        resource_type: 'high_risk_action',
        action_description: buildActionDescription(actionType, path),
        new_value: {
          action_id: actionId,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          actor_key: actor.actorKey,
        },
        response_status: statusCode,
        error_message: errorMessage,
        execution_time: executionTime,
      }).catch(() => {});
    };

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    res.set('X-Action-Id', actionId);

    res.json = payload => {
      responseBody = payload;
      return originalJson(payload);
    };

    res.send = payload => {
      if (responseBody === undefined) {
        responseBody = payload;
      }
      return originalSend(payload);
    };

    res.on('finish', () => {
      finalize().catch(() => {});
    });

    res.on('close', () => {
      finalize().catch(() => {});
    });

    return next();
  })().catch(error => {
    return res.status(500).json({
      success: false,
      code: 'HIGH_RISK_GATE_INTERNAL_ERROR',
      message: `高风险动作闸门异常: ${error.message}`,
    });
  });
}

module.exports = {
  highRiskActionGate,
};
