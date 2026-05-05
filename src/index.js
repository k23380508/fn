import { buildSnapshot } from "./snapshot.js";
import { renderHtml } from "./render.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("ok", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }

    if (url.pathname === "/api/snapshot") {
      try {
        const snap = await buildSnapshot(env);
        return new Response(JSON.stringify(snap, null, 2), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=60",
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
        const snap = await buildSnapshot(env);
        const html = renderHtml(snap);
        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
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
