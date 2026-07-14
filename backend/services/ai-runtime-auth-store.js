const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const STORE_DIR =
  process.env.AI_RUNTIME_AUTH_STORE_DIR ||
  process.env.ASSETHUB_RUNTIME_AUTH_STORE_DIR ||
  path.join('/tmp', 'assethub-ai-runtime-auth');
const TTL_MS = Math.max(60 * 1000, parseInt(process.env.AI_RUNTIME_AUTH_TTL_MS || '300000', 10));

function extractBearerToken(authHeader) {
  const value = String(authHeader || '').trim();
  if (!/^Bearer\s+/i.test(value)) {
    return '';
  }
  return value.replace(/^Bearer\s+/i, '').trim();
}

async function ensureStoreDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

async function cleanupExpiredFiles(now = Date.now()) {
  try {
    const entries = await fs.readdir(STORE_DIR, { withFileTypes: true });
    await Promise.all(
      entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(async entry => {
          const filePath = path.join(STORE_DIR, entry.name);
          try {
            const raw = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            const expiresAt = Number(parsed?.expiresAt || 0);
            if (expiresAt > 0 && expiresAt <= now) {
              await fs.unlink(filePath);
            }
          } catch {
            await fs.unlink(filePath).catch(() => {});
          }
        }),
    );
  } catch {
    // Ignore cleanup failures. Runtime auth creation should still proceed.
  }
}

async function registerAuthContext(authContext = {}) {
  const token = extractBearerToken(authContext.authHeader);
  const tenantId = Number.parseInt(String(authContext.tenantId ?? ''), 10);

  if (!token) {
    return null;
  }

  await ensureStoreDir();
  await cleanupExpiredFiles();

  const id = `ctx_${crypto.randomBytes(12).toString('hex')}`;
  const now = Date.now();
  const payload = {
    id,
    token,
    tenantId: Number.isInteger(tenantId) && tenantId > 0 ? tenantId : null,
    userId: authContext.userId || null,
    username: authContext.username || null,
    role: authContext.role || null,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };

  const filePath = path.join(STORE_DIR, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });

  return {
    id,
    tenantId: payload.tenantId,
    expiresAt: payload.expiresAt,
    storeDir: STORE_DIR,
  };
}

module.exports = {
  STORE_DIR,
  TTL_MS,
  extractBearerToken,
  registerAuthContext,
};
