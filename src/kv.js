export async function getCached(key, env) {
  if (!env?.MACRO_CACHE) return null;
  try {
    const raw = await env.MACRO_CACHE.get(key, { type: "json" });
    return raw;
  } catch {
    return null;
  }
}

export async function putCached(key, value, env, ttlSec = 5400) {
  if (!env?.MACRO_CACHE) return;
  try {
    await env.MACRO_CACHE.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSec) });
  } catch {
    // best-effort cache; ignore failures
  }
}
