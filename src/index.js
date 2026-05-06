import { buildSnapshot } from "./snapshot.js";
import { renderHtml } from "./render.js";
import { getCached, putCached } from "./kv.js";
import { fetchSeries, RANGES, SERIES_REGISTRY } from "./series.js";
import { buildNews } from "./sources/news.js";
import { buildReasonsFor } from "./sources/reasons.js";
import { buildCalendar } from "./sources/calendar.js";

// OWASP-aligned baseline security headers added to every response.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  // CSP: page uses inline script + style for charts/modals, so allow self+inline.
  // Restricts loading of external scripts/iframes; img/connect kept open for self-fetched APIs.
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "frame-ancestors 'self'; " +
    "base-uri 'self'; " +
    "form-action 'self'",
};

function withSecurity(headers = {}) {
  return { ...SECURITY_HEADERS, ...headers };
}

const SNAPSHOT_KEY = "snapshot:latest";
const SNAPSHOT_TTL = 5400; // 90 minutes
const SERIES_TTL = 3600;   // 1 hour
const NEWS_KEY = "news:v6:latest";
const NEWS_TTL = 900;      // 15 minutes
const REASON_TTL = 86400;  // 24 hours per id (static analysis stable for the day)
const CALENDAR_KEY = "calendar:v4:thisweek";
const CALENDAR_TTL = 3600; // 1 hour

async function getOrBuildSnapshot(env, { force = false } = {}) {
  if (!force) {
    const cached = await getCached(SNAPSHOT_KEY, env);
    if (cached?.generatedAt) return { snapshot: cached, source: "kv" };
  }
  const fresh = await buildSnapshot(env);
  await putCached(SNAPSHOT_KEY, fresh, env, SNAPSHOT_TTL);
  return { snapshot: fresh, source: "fresh" };
}

async function getOrBuildNews(env, { force = false } = {}) {
  if (!force) {
    const cached = await getCached(NEWS_KEY, env);
    if (cached?.generatedAt) return cached;
  }
  const fresh = await buildNews(env);
  await putCached(NEWS_KEY, fresh, env, NEWS_TTL);
  return fresh;
}

async function getOrBuildCalendar(env, { force = false } = {}) {
  if (!force) {
    const cached = await getCached(CALENDAR_KEY, env);
    if (cached?.generatedAt) return cached;
  }
  const fresh = await buildCalendar();
  await putCached(CALENDAR_KEY, fresh, env, CALENDAR_TTL);
  return fresh;
}

async function handleRequest(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("ok", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (url.pathname === "/favicon.ico" || url.pathname === "/favicon.svg") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="52" font-size="56">🌏</text></svg>`;
      return new Response(svg, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=86400, immutable",
        },
      });
    }

    if (url.pathname === "/api/series") {
      try {
        const id = url.searchParams.get("id");
        const range = url.searchParams.get("range") || "1M";
        const force = url.searchParams.get("fresh") === "1";
        if (!id || !SERIES_REGISTRY[id]) {
          return new Response(JSON.stringify({ error: `unknown id: ${id}` }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
        }
        if (!RANGES.includes(range)) {
          return new Response(JSON.stringify({ error: `unknown range: ${range}, must be one of ${RANGES.join(",")}` }), { status: 400, headers: { "content-type": "application/json; charset=utf-8" } });
        }
        const cacheKey = `series:${id}:${range}`;
        let payload;
        let source = "fresh";
        if (!force) {
          const cached = await getCached(cacheKey, env);
          if (cached?.series) { payload = cached; source = "kv"; }
        }
        if (!payload) {
          const series = await fetchSeries(id, range, env);
          payload = { id, range, series, generatedAt: new Date().toISOString() };
          await putCached(cacheKey, payload, env, SERIES_TTL);
        }
        return new Response(JSON.stringify(payload), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
            "x-cache": source,
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    if (url.pathname === "/api/snapshot") {
      try {
        const force = url.searchParams.get("fresh") === "1";
        const { snapshot, source } = await getOrBuildSnapshot(env, { force });
        return new Response(JSON.stringify(snapshot, null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=60",
            "x-cache": source,
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    if (url.pathname === "/api/reasons") {
      try {
        const idsParam = url.searchParams.get("ids") || "";
        const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
        if (!ids.length) return new Response(JSON.stringify({}), { headers: { "content-type": "application/json; charset=utf-8" } });
        const force = url.searchParams.get("fresh") === "1";
        const out = {};
        const missing = [];
        for (const id of ids) {
          if (!force) {
            const cached = await getCached(`reason:v4:${id}`, env);
            if (cached?.headline) { out[id] = cached; continue; }
          }
          missing.push(id);
        }
        if (missing.length) {
          const inputs = missing.map((id) => ({ id }));
          const built = await buildReasonsFor(inputs, env);
          for (const id of missing) {
            if (built[id]) {
              out[id] = built[id];
              await putCached(`reason:v4:${id}`, built[id], env, REASON_TTL);
            }
          }
        }
        return new Response(JSON.stringify(out), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
      }
    }

    if (url.pathname === "/api/calendar") {
      try {
        const force = url.searchParams.get("fresh") === "1";
        const cal = await getOrBuildCalendar(env, { force });
        return new Response(JSON.stringify(cal), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=600" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    if (url.pathname === "/api/news") {
      try {
        const force = url.searchParams.get("fresh") === "1";
        const news = await getOrBuildNews(env, { force });
        return new Response(JSON.stringify(news), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    if (url.pathname === "/" || url.pathname === "") {
      try {
        const [{ snapshot, source }, news, calendar] = await Promise.all([
          getOrBuildSnapshot(env),
          getOrBuildNews(env).catch((e) => ({ kr: { error: e.message }, us: { error: e.message } })),
          getOrBuildCalendar(env).catch((e) => ({ error: e.message, events: [] })),
        ]);
        const html = renderHtml(snapshot, news, calendar);
        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
            "x-cache": source,
          },
        });
      } catch (e) {
        return new Response(`<pre>error: ${e.message}</pre>`, {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
}

function applySecurityHeaders(res) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!h.has(k)) h.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const res = await handleRequest(request, env);
      return applySecurityHeaders(res);
    } catch (e) {
      return applySecurityHeaders(new Response(`<pre>error: ${e.message}</pre>`, {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
