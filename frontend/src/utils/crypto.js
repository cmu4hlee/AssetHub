/**
 * 敏感数据加密工具 - 用于 localStorage 安全存储
 * 提供同步（Base64混淆）和异步（AES-GCM加密）两种接口
 * 敏感数据（token、user）建议使用异步加密接口
 * 
 * 内存缓存机制：setItemAsync 写入时同时缓存解密值，getItem 同步读取时优先从缓存获取
 */

const ENCRYPTION_KEY_CACHE = 'asset_crypto_key';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

const sensitiveKeys = new Set(['token', 'user', 'enterprises', 'selectedEnterprise', 'openclaw_credentials']);

const memoryCache = new Map();

let encryptionKeyPromise = null;

function getSubtle() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto.subtle;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

function isCryptoAvailable() {
  return getSubtle() !== null;
}

function getOrCreateEncryptionKey() {
  if (encryptionKeyPromise) return encryptionKeyPromise;

  const subtle = getSubtle();
  if (!subtle) {
    console.warn('[crypto] Web Crypto API 不可用（非安全上下文，如 HTTP IP 直连），降级到 Base64 混淆存储');
    encryptionKeyPromise = Promise.resolve(null);
    return encryptionKeyPromise;
  }

  encryptionKeyPromise = (async () => {
    const cachedKey = localStorage.getItem(ENCRYPTION_KEY_CACHE);
    if (cachedKey) {
      try {
        const keyData = JSON.parse(cachedKey);
        return await subtle.importKey(
          'jwk',
          keyData,
          { name: ALGORITHM, length: KEY_LENGTH },
          true,
          ['encrypt', 'decrypt']
        );
      } catch {
        localStorage.removeItem(ENCRYPTION_KEY_CACHE);
      }
    }

    const key = await subtle.generateKey(
      { name: ALGORITHM, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );

    const exportedKey = await subtle.exportKey('jwk', key);
    localStorage.setItem(ENCRYPTION_KEY_CACHE, JSON.stringify(exportedKey));

    return key;
  })();

  return encryptionKeyPromise;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64ToArrayBuffer(base64) {
  let base64String = base64.replace(/-/g, '+').replace(/_/g, '/');
  while (base64String.length % 4) {
    base64String += '=';
  }
  const binary = atob(base64String);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function encodeSimple(str) {
  if (!str) return '';
  try {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return '';
  }
}

function decodeSimple(str) {
  if (!str) return '';
  try {
    return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
  } catch {
    return '';
  }
}

async function encrypt(plaintext) {
  if (!plaintext) return '';
  try {
    const key = await getOrCreateEncryptionKey();
    if (!key) {
      return 'S:' + encodeSimple(plaintext);
    }
    const subtle = getSubtle();
    const ivBuf = (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues)
      ? window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
      : null;
    if (!subtle || !ivBuf) {
      return 'S:' + encodeSimple(plaintext);
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const encrypted = await subtle.encrypt(
      { name: ALGORITHM, iv: ivBuf, tagLength: TAG_LENGTH },
      key,
      data
    );

    const combined = new Uint8Array(ivBuf.length + encrypted.byteLength);
    combined.set(ivBuf);
    combined.set(new Uint8Array(encrypted), ivBuf.length);

    return 'E:' + arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.warn('加密失败:', error);
    return 'S:' + encodeSimple(plaintext);
  }
}

async function decrypt(ciphertext) {
  if (!ciphertext) return '';
  if (ciphertext.startsWith('S:')) {
    return decodeSimple(ciphertext.slice(2));
  }
  if (!ciphertext.startsWith('E:')) {
    return decodeSimple(ciphertext);
  }
  try {
    const key = await getOrCreateEncryptionKey();
    if (!key) {
      return decodeSimple(ciphertext.slice(2));
    }
    const subtle = getSubtle();
    if (!subtle) {
      return decodeSimple(ciphertext.slice(2));
    }
    const combined = new Uint8Array(base64ToArrayBuffer(ciphertext.slice(2)));
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);

    const decrypted = await subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.warn('解密失败:', error);
    return '';
  }
}

function isSensitiveKey(key) {
  for (const sensitiveKey of sensitiveKeys) {
    if (key === sensitiveKey || key.endsWith('_' + sensitiveKey)) {
      return true;
    }
  }
  return false;
}

export function setItem(key, value) {
  if (!key) return;
  try {
    const jsonStr = JSON.stringify(value);
    const encoded = encodeSimple(jsonStr);
    localStorage.setItem(key, encoded);
    memoryCache.set(key, value);
  } catch (error) {
    console.warn(`存储 ${key} 失败:`, error);
  }
}

export function getItem(key) {
  if (!key) return null;
  
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    if (stored.startsWith('E:')) {
      console.warn(`加密数据需要使用 getItemAsync('${key}') 异步读取`);
      return null;
    }

    if (stored.startsWith('S:')) {
      const decoded = decodeSimple(stored.slice(2));
      const value = decoded ? JSON.parse(decoded) : null;
      memoryCache.set(key, value);
      return value;
    }

    const decoded = decodeSimple(stored);
    const value = decoded ? JSON.parse(decoded) : null;
    memoryCache.set(key, value);
    return value;
  } catch (error) {
    console.warn(`读取 ${key} 失败:`, error);
    return null;
  }
}

export async function setItemAsync(key, value) {
  if (!key) return;
  try {
    const jsonStr = JSON.stringify(value);
    let stored;
    if (isSensitiveKey(key)) {
      stored = await encrypt(jsonStr);
      if (!stored) {
        stored = encodeSimple(jsonStr);
      }
    } else {
      stored = encodeSimple(jsonStr);
    }
    localStorage.setItem(key, stored);
    memoryCache.set(key, value);
  } catch (error) {
    console.warn(`加密存储 ${key} 失败:`, error);
  }
}

export async function getItemAsync(key) {
  if (!key) return null;

  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    let decoded;
    if (stored.startsWith('S:')) {
      decoded = decodeSimple(stored.slice(2));
    } else if (isSensitiveKey(key) && stored.startsWith('E:')) {
      decoded = await decrypt(stored);
    } else {
      decoded = decodeSimple(stored);
    }

    const value = decoded ? JSON.parse(decoded) : null;
    memoryCache.set(key, value);
    return value;
  } catch (error) {
    console.warn(`解密 ${key} 失败，清除损坏数据:`, error.message);
    localStorage.removeItem(key);
    return null;
  }
}

export const removeItem = key => {
  if (!key) return;
  localStorage.removeItem(key);
  memoryCache.delete(key);
};

export function clearCache() {
  memoryCache.clear();
}

/**
 * 初始化缓存：页面加载时解密所有 E: 开头的敏感数据到内存缓存
 * 确保 auth.getUser() 等同步方法能在页面刷新后正常工作
 */
export async function initCache() {
  try {
    for (const key of sensitiveKeys) {
      if (memoryCache.has(key)) continue;
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      if (stored.startsWith('S:')) {
        try {
          const decoded = decodeSimple(stored.slice(2));
          if (decoded) {
            memoryCache.set(key, JSON.parse(decoded));
          }
        } catch (e) {
          console.warn(`解析 ${key} 降级数据失败，清除损坏数据:`, e.message);
          localStorage.removeItem(key);
        }
        continue;
      }
      if (stored.startsWith('E:')) {
        try {
          const decrypted = await decrypt(stored);
          if (decrypted) {
            const value = JSON.parse(decrypted);
            memoryCache.set(key, value);
          }
        } catch (e) {
          console.warn(`解密 ${key} 失败，清除损坏数据:`, e.message);
          localStorage.removeItem(key);
        }
      }
    }
  } catch (error) {
    console.warn('缓存初始化失败:', error);
  }
}

export { encodeSimple, decodeSimple, isSensitiveKey };

export default { setItem, getItem, setItemAsync, getItemAsync, removeItem, clearCache, encodeSimple, decodeSimple, isSensitiveKey, initCache };
