/**
 * OpenCode Server Manager
 * Talks to `opencode serve` over HTTP and can optionally auto-start it locally.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { Buffer } = require('buffer');
const { URL } = require('url');

const DEFAULT_PORT = parseInt(process.env.OPENCODE_SERVER_PORT, 10) || 4096;
const DEFAULT_HOST = process.env.OPENCODE_SERVER_HOST || '127.0.0.1';
const DEFAULT_PROTOCOL = String(process.env.OPENCODE_SERVER_PROTOCOL || 'http').trim() || 'http';
const STARTUP_TIMEOUT_MS = parseInt(process.env.OPENCODE_SERVER_STARTUP_TIMEOUT_MS, 10) || 15000;
const HEALTH_CHECK_INTERVAL_MS =
  parseInt(process.env.OPENCODE_SERVER_HEALTH_CHECK_INTERVAL_MS, 10) || 30000;
const SESSION_TTL_HOURS = parseInt(process.env.OPENCODE_SESSION_TTL_HOURS, 10) || 24;
const OPENCODE_AUTOSTART = process.env.OPENCODE_SERVER_AUTOSTART !== 'false';
const OPENCODE_SERVER_USERNAME = process.env.OPENCODE_SERVER_USERNAME || 'opencode';
const OPENCODE_SERVER_PASSWORD = String(process.env.OPENCODE_SERVER_PASSWORD || '').trim();

function resolveOpencodeCommand() {
  if (process.env.OPENCODE_COMMAND) {
    return process.env.OPENCODE_COMMAND;
  }

  const homeBinary = path.join(os.homedir(), '.opencode', 'bin', 'opencode');
  if (fs.existsSync(homeBinary)) {
    return homeBinary;
  }

  return 'opencode';
}

const OPENCODE_COMMAND = resolveOpencodeCommand();

function parseJsonSafely(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(item => normalizeText(item)).filter(Boolean).join('');
  }

  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.message === 'string') return value.message;
    if (typeof value.output_text === 'string') return value.output_text;
    if (typeof value.answer === 'string') return value.answer;
    if (typeof value.result === 'string') return value.result;
    if (typeof value.value === 'string') return value.value;
    if (value.message && typeof value.message === 'object') return normalizeText(value.message);
    if (Array.isArray(value.parts)) return normalizeText(value.parts);
    if (Array.isArray(value.content)) return normalizeText(value.content);
  }

  return '';
}

function truncate(value, max = 400) {
  const text = normalizeText(value).trim();
  if (!text) {
    return '';
  }

  return text.length > max ? `${text.slice(0, max)}...` : text;
}

class OpenCodeServerManager {
  constructor() {
    this.process = null;
    this.protocol = DEFAULT_PROTOCOL === 'https' ? 'https' : 'http';
    this.port = DEFAULT_PORT;
    this.host = DEFAULT_HOST;
    this.baseUrl = `${this.protocol}://${this.host}:${this.port}`;
    this.ready = false;
    this.readyPromise = null;
    this.healthCheckTimer = null;
    this.sessionIdMapping = new Map();
    this.sessionMeta = new Map();
  }

  buildHeaders(extraHeaders = {}) {
    const headers = {
      Accept: 'application/json',
      ...extraHeaders,
    };

    if (OPENCODE_SERVER_PASSWORD) {
      const auth = Buffer.from(
        `${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}`,
        'utf8',
      ).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }

    return headers;
  }

  async ensureServerRunning() {
    if (await this.isHealthy()) {
      if (!this.healthCheckTimer) {
        this.startHealthCheck();
      }
      return;
    }

    if (!OPENCODE_AUTOSTART) {
      throw new Error(
        `OpenCode 网关不可用，请先启动 ${OPENCODE_COMMAND} serve（${this.baseUrl}）`,
      );
    }

    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = this.startServer().finally(() => {
      if (!this.ready) {
        this.readyPromise = null;
      }
    });
    return this.readyPromise;
  }

  async isHealthy() {
    try {
      const result = await this.makeRequest('GET', '/global/health');
      const healthy = result.status >= 200 && result.status < 300;
      this.ready = healthy;
      return healthy;
    } catch {
      this.ready = false;
      return false;
    }
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let stderrOutput = '';

      const finish = callback => value => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(startupTimer);
        callback(value);
      };

      const fail = finish(error => {
        this.ready = false;
        this.readyPromise = null;
        reject(error);
      });

      const succeed = finish(() => {
        this.ready = true;
        this.startHealthCheck();
        console.log(`[OpenCodeServer] Server is ready at ${this.baseUrl}`);
        resolve();
      });

      const startupTimer = setTimeout(() => {
        const detail = truncate(stderrOutput) || `${this.baseUrl} 未在超时时间内可访问`;
        fail(new Error(`OpenCode server startup timed out after ${STARTUP_TIMEOUT_MS}ms: ${detail}`));
      }, STARTUP_TIMEOUT_MS);

      const args = ['serve', '--port', String(this.port), '--hostname', this.host];
      const corsOrigins = String(process.env.OPENCODE_SERVER_CORS || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      corsOrigins.forEach(origin => args.push('--cors', origin));

      console.log(`[OpenCodeServer] Starting ${OPENCODE_COMMAND} ${args.join(' ')}`);

      this.process = spawn(OPENCODE_COMMAND, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        windowsHide: true,
      });

      this.process.stdout.on('data', data => {
        const text = data.toString().trim();
        if (text) {
          console.log(`[OpenCodeServer] ${text}`);
        }
      });

      this.process.stderr.on('data', data => {
        const text = data.toString();
        stderrOutput += text;
        const trimmed = text.trim();
        if (trimmed) {
          console.warn(`[OpenCodeServer] ${trimmed}`);
        }
      });

      this.process.on('error', error => {
        this.process = null;
        fail(error);
      });

      this.process.on('exit', (code, signal) => {
        const beforeReady = !this.ready;
        this.ready = false;
        this.process = null;

        if (beforeReady) {
          const detail = truncate(stderrOutput);
          const message =
            detail ||
            `OpenCode server exited before becoming ready (code=${code}, signal=${signal})`;
          fail(new Error(message));
          return;
        }

        console.warn(`[OpenCodeServer] Process exited with code=${code}, signal=${signal}`);
      });

      const pollReady = async () => {
        if (settled) {
          return;
        }

        if (await this.isHealthy()) {
          succeed();
          return;
        }

        setTimeout(pollReady, 500);
      };

      setTimeout(pollReady, 500);
    });
  }

  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        const healthy = await this.isHealthy();
        if (!healthy) {
          throw new Error('health check returned unhealthy');
        }
      } catch (error) {
        console.warn('[OpenCodeServer] Health check failed:', error.message);
        this.ready = false;
        this.readyPromise = null;

        if (OPENCODE_AUTOSTART) {
          this.ensureServerRunning().catch(restartError => {
            console.error('[OpenCodeServer] Restart failed:', restartError.message);
          });
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  buildSessionTitle(frontendSessionId, tenantId, userId) {
    if (frontendSessionId) {
      return `AssetHub ${frontendSessionId}`;
    }
    return `AssetHub tenant=${tenantId || '0'} user=${userId || 'anonymous'} ${Date.now()}`;
  }

  extractSessionId(payload) {
    const data = parseJsonSafely(payload) || payload || {};
    return String(data?.id || data?.sessionId || '').trim();
  }

  extractMessageText(payload) {
    const data = parseJsonSafely(payload) || payload || {};
    const partCollections = [data?.parts, data?.data?.parts, data?.message?.parts];

    for (const parts of partCollections) {
      if (!Array.isArray(parts)) {
        continue;
      }

      const textParts = parts
        .filter(part => part?.type === 'text')
        .map(part => normalizeText(part?.text).trim())
        .filter(Boolean);

      if (textParts.length > 0) {
        return textParts.join('\n').trim();
      }
    }

    const candidates = [
      data?.message?.content,
      data?.data?.message?.content,
      data?.data?.content,
      data?.data?.text,
      data?.output_text,
      data?.data?.output_text,
      data?.info?.structured_output,
      data?.data?.info?.structured_output,
      data?.content,
      data?.text,
      data?.message,
    ];

    for (const candidate of candidates) {
      const text = normalizeText(candidate).trim();
      if (text) {
        return text;
      }
    }

    return '';
  }

  rememberSession(frontendSessionId, opencodeSessionId, tenantId, userId) {
    if (!frontendSessionId || !opencodeSessionId) {
      return;
    }

    this.sessionIdMapping.set(frontendSessionId, opencodeSessionId);
    this.sessionMeta.set(frontendSessionId, {
      tenantId: tenantId || null,
      userId: userId || null,
      createdAt: Date.now(),
    });
  }

  resolveMappedSessionId(frontendSessionId) {
    if (!frontendSessionId) {
      return '';
    }
    return String(this.sessionIdMapping.get(frontendSessionId) || '').trim();
  }

  async createSession(frontendSessionId, tenantId, userId) {
    await this.ensureServerRunning();

    const title = this.buildSessionTitle(frontendSessionId, tenantId, userId);
    const result = await this.makeRequest('POST', '/session', { title });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `Failed to create OpenCode session (${result.status}): ${truncate(result.data) || 'unknown error'}`,
      );
    }

    const opencodeSessionId = this.extractSessionId(result.data);
    if (!opencodeSessionId) {
      throw new Error('OpenCode session.create did not return a session id');
    }

    this.rememberSession(frontendSessionId, opencodeSessionId, tenantId, userId);
    return {
      sessionId: frontendSessionId || opencodeSessionId,
      opencodeSessionId,
    };
  }

  async createEphemeralSession(tenantId, userId) {
    return this.createSession(null, tenantId, userId);
  }

  async getOrCreateSession(frontendSessionId, tenantId, userId) {
    const opencodeSessionId = this.resolveMappedSessionId(frontendSessionId);
    if (opencodeSessionId) {
      return {
        sessionId: frontendSessionId,
        opencodeSessionId,
      };
    }

    return this.createSession(frontendSessionId, tenantId, userId);
  }

  async promptSession(opencodeSessionId, prompt) {
    await this.ensureServerRunning();

    const result = await this.makeRequest(
      'POST',
      `/session/${encodeURIComponent(opencodeSessionId)}/message`,
      {
        parts: [{ type: 'text', text: prompt }],
      },
    );

    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `OpenCode message failed (${result.status}): ${truncate(result.data) || 'unknown error'}`,
      );
    }

    const text = this.extractMessageText(result.data);
    if (!text) {
      const error = new Error('OpenCode returned an empty assistant message');
      error.code = 'OPENCODE_EMPTY_MESSAGE';
      error.detail = {
        status: result.status,
        payload: parseJsonSafely(result.data) || result.data || null,
      };
      throw error;
    }

    return text;
  }

  async sendMessage(frontendSessionId, prompt, tenantId, userId) {
    const { opencodeSessionId } = await this.getOrCreateSession(frontendSessionId, tenantId, userId);
    return this.promptSession(opencodeSessionId, prompt);
  }

  async sendEphemeralMessage(prompt, tenantId, userId) {
    const { opencodeSessionId } = await this.createEphemeralSession(tenantId, userId);
    return this.promptSession(opencodeSessionId, prompt);
  }

  async sendMessageStream(frontendSessionId, prompt, tenantId, userId, onChunk, onDone, onError) {
    try {
      const content = await this.sendMessage(frontendSessionId, prompt, tenantId, userId);
      if (content) {
        onChunk(content);
      }
      onDone();
    } catch (error) {
      onError(error);
    }
  }

  async getSessionMessages(frontendSessionId) {
    await this.ensureServerRunning();

    const opencodeSessionId =
      this.resolveMappedSessionId(frontendSessionId) || String(frontendSessionId || '').trim();
    if (!opencodeSessionId) {
      throw new Error(`Session not found: ${frontendSessionId || ''}`);
    }

    const result = await this.makeRequest(
      'GET',
      `/session/${encodeURIComponent(opencodeSessionId)}/message`,
    );
    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `Failed to get OpenCode session messages (${result.status}): ${truncate(result.data) || 'unknown error'}`,
      );
    }

    return parseJsonSafely(result.data) || result.data;
  }

  async deleteSession(frontendSessionId) {
    const key = String(frontendSessionId || '').trim();
    if (!key) {
      return;
    }

    this.sessionIdMapping.delete(key);
    this.sessionMeta.delete(key);
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    const ttlMs = SESSION_TTL_HOURS * 60 * 60 * 1000;

    for (const [frontendSessionId, meta] of this.sessionMeta.entries()) {
      if (!meta?.createdAt || now - meta.createdAt <= ttlMs) {
        continue;
      }

      this.sessionMeta.delete(frontendSessionId);
      this.sessionIdMapping.delete(frontendSessionId);
    }
  }

  makeRequest(method, pathname, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(pathname, this.baseUrl);
      const client = url.protocol === 'https:' ? https : http;
      const payload = body ? JSON.stringify(body) : null;
      const headers = this.buildHeaders(
        payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
      );

      const req = client.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          headers,
        },
        res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode || 0,
              headers: res.headers || {},
              data,
            });
          });
        },
      );

      req.on('error', reject);

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  async shutdown() {
    console.log('[OpenCodeServer] Shutting down...');
    this.stopHealthCheck();
    this.sessionIdMapping.clear();
    this.sessionMeta.clear();

    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    this.ready = false;
    this.readyPromise = null;
    console.log('[OpenCodeServer] Shutdown complete');
  }
}

module.exports = new OpenCodeServerManager();
