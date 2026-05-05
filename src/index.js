import { buildSnapshot } from "./snapshot.js";
import { renderHtml } from "./render.js";
import { getCached, putCached } from "./kv.js";

const SNAPSHOT_KEY = "snapshot:latest";
const SNAPSHOT_TTL = 5400; // 90 minutes

async function getOrBuildSnapshot(env, { force = false } = {}) {
  if (!force) {
    const cached = await getCached(SNAPSHOT_KEY, env);
    if (cached?.generatedAt) return { snapshot: cached, source: "kv" };
  }
  const fresh = await buildSnapshot(env);
  await putCached(SNAPSHOT_KEY, fresh, env, SNAPSHOT_TTL);
  return { snapshot: fresh, source: "fresh" };
}

export default {
  async fetch(request, env) {
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

    if (url.pathname === "/" || url.pathname === "") {
      try {
        const { snapshot, source } = await getOrBuildSnapshot(env);
        const html = renderHtml(snapshot);
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
  },
};
