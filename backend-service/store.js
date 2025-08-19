// Unified storage for sessions and extension token handoff.
// Uses Vercel KV in production; falls back to in-memory for local dev.

let kv = null;
let kvConfigured = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  kv = require('@vercel/kv').kv;
  kvConfigured = Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  );
} catch (e) {
  kvConfigured = false;
}

// In-memory fallback for local development
const memory = {
  sessions: new Map(),
  extLatest: null,
  extLatestTimeout: null
};

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const EXT_TOKEN_TTL_SECONDS = 60 * 5; // 5 minutes

async function setUserSession(userId, sessionData) {
  if (kvConfigured && kv) {
    try {
      await kv.set(`session:${userId}`, sessionData, { ex: SESSION_TTL_SECONDS });
      return;
    } catch (error) {
      console.error('KV setUserSession failed; falling back to memory:', error?.message || error);
    }
  } else {
    memory.sessions.set(userId, sessionData);
    return;
  }
  memory.sessions.set(userId, sessionData);
}

async function getUserSession(userId) {
  if (kvConfigured && kv) {
    try {
      return await kv.get(`session:${userId}`);
    } catch (error) {
      console.error('KV getUserSession failed; falling back to memory:', error?.message || error);
    }
  }
  return memory.sessions.get(userId) || null;
}

async function deleteUserSession(userId) {
  if (kvConfigured && kv) {
    try {
      await kv.del(`session:${userId}`);
      return;
    } catch (error) {
      console.error('KV deleteUserSession failed; falling back to memory:', error?.message || error);
    }
  } else {
    memory.sessions.delete(userId);
    return;
  }
  memory.sessions.delete(userId);
}

async function storeExtensionToken(token, userData) {
  const payload = { token, userData, createdAt: Date.now() };
  // We keep a single latest slot to satisfy the current polling behavior
  if (kvConfigured && kv) {
    try {
      await kv.set('ext:latest', payload, { ex: EXT_TOKEN_TTL_SECONDS });
    } catch (error) {
      console.error('KV storeExtensionToken failed; falling back to memory:', error?.message || error);
      memory.extLatest = payload;
      if (memory.extLatestTimeout) clearTimeout(memory.extLatestTimeout);
      memory.extLatestTimeout = setTimeout(() => {
        memory.extLatest = null;
      }, EXT_TOKEN_TTL_SECONDS * 1000);
    }
  } else {
    memory.extLatest = payload;
    if (memory.extLatestTimeout) clearTimeout(memory.extLatestTimeout);
    memory.extLatestTimeout = setTimeout(() => {
      memory.extLatest = null;
    }, EXT_TOKEN_TTL_SECONDS * 1000);
  }
  // Return a sessionKey for compatibility (not used by the extension today)
  return { sessionKey: 'latest' };
}

async function pollExtensionToken() {
  if (kvConfigured && kv) {
    try {
      const value = await kv.get('ext:latest');
      if (value) {
        await kv.del('ext:latest');
        return value;
      }
      return null;
    } catch (error) {
      console.error('KV pollExtensionToken failed; falling back to memory:', error?.message || error);
    }
  }
  const value = memory.extLatest;
  memory.extLatest = null; // one-time read
  return value || null;
}

module.exports = {
  setUserSession,
  getUserSession,
  deleteUserSession,
  storeExtensionToken,
  pollExtensionToken
};


