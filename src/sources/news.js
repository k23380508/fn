// Top headlines (general "hottest news") for KR + US, plus AI-focused search.
const KR_URL = "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko";
const US_URL = "https://news.google.com/rss?hl=en&gl=US&ceid=US:en";
const AI_URL = "https://news.google.com/rss/search?q=%22AI%22+OR+OpenAI+OR+Anthropic+OR+ChatGPT+OR+Claude+OR+Gemini+OR+LLM+OR+%22Workers+AI%22&hl=en&gl=US&ceid=US:en&when=1d";

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function unwrapCdata(s) {
  if (!s) return "";
  const m = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(s);
  return decodeEntities((m ? m[1] : s).trim());
}

function extract(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = re.exec(block);
  return m ? m[1] : "";
}

async function fetchRss(url, limit) {
  const res = await fetch(url, {
    cf: { cacheTtl: 300, cacheEverything: true },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; mp1-worker/1.0)" },
  });
  if (!res.ok) throw new Error(`News HTTP ${res.status}`);
  const xml = await res.text();
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    items.push({
      title: unwrapCdata(extract(block, "title")),
      link: unwrapCdata(extract(block, "link")),
      pubDate: unwrapCdata(extract(block, "pubDate")),
      source: unwrapCdata(extract(block, "source")),
    });
  }
  return items;
}

async function translateToKo(text, env) {
  if (!env?.AI || !text) return null;
  try {
    const res = await env.AI.run("@cf/meta/m2m100-1.2b", {
      text,
      source_lang: "english",
      target_lang: "korean",
    });
    const ko = res?.translated_text;
    if (ko && typeof ko === "string" && ko.trim() && ko.trim() !== text.trim()) return ko.trim();
    return null;
  } catch {
    return null;
  }
}

async function fetchSection(url, limit, { translate, env }) {
  const items = await fetchRss(url, limit);
  if (!translate) {
    return items.map((n) => ({ ...n, originalTitle: n.title }));
  }
  return Promise.all(items.map(async (n) => {
    const ko = await translateToKo(n.title, env);
    return { ...n, originalTitle: n.title, title: ko || n.title, translated: !!ko };
  }));
}

export async function buildNews(env, { limit = 5 } = {}) {
  const [krRes, usRes, aiRes] = await Promise.allSettled([
    fetchSection(KR_URL, limit, { translate: false, env }),
    fetchSection(US_URL, limit, { translate: true, env }),
    fetchSection(AI_URL, limit, { translate: true, env }),
  ]);
  const pack = (r) => r.status === "fulfilled" ? r.value : { error: r.reason?.message || String(r.reason) };
  return {
    generatedAt: new Date().toISOString(),
    kr: pack(krRes),
    us: pack(usRes),
    ai: pack(aiRes),
  };
}
