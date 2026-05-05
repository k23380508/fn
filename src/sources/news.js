// Top headlines (general "hottest news") for KR + US, plus AI-focused search.
const KR_URL = "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko";
const US_URL = "https://news.google.com/rss?hl=en&gl=US&ceid=US:en";
const AI_URL = "https://news.google.com/rss/search?q=%22AI%22+OR+OpenAI+OR+Anthropic+OR+ChatGPT+OR+Claude+OR+Gemini+OR+LLM+OR+%22Workers+AI%22&hl=en&gl=US&ceid=US:en&when=1d";
// 한국 빅테크 — 종목명 + 주가/실적/투자 키워드로 가격에 영향 있는 뉴스만
const KR_TECH_URL = "https://news.google.com/rss/search?q=(%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90+OR+SK%ED%95%98%EC%9D%B4%EB%8B%89%EC%8A%A4+OR+%EB%84%A4%EC%9D%B4%EB%B2%84+OR+%EC%B9%B4%EC%B9%B4%EC%98%A4+OR+%EC%97%90%EB%84%88%EC%A7%80%EC%86%94%EB%A3%A8%EC%85%98)+(%EC%A3%BC%EA%B0%80+OR+%EC%8B%A4%EC%A0%81+OR+%ED%88%AC%EC%9E%90+OR+%EB%AA%A9%ED%91%9C%EA%B0%80+OR+%EB%A7%A4%EC%88%98+OR+%EB%A7%A4%EB%8F%84)&hl=ko&gl=KR&ceid=KR:ko&when=2d";
// 미국 빅테크 — Magnificent 5 + stock/earnings 키워드
const US_TECH_URL = "https://news.google.com/rss/search?q=(Apple+OR+Microsoft+OR+NVIDIA+OR+Alphabet+OR+Google+OR+Amazon)+(stock+OR+earnings+OR+price+OR+%22share+price%22+OR+target+OR+upgrade+OR+downgrade)&hl=en&gl=US&ceid=US:en&when=2d";
// 중국 빅테크 — 종목명 + stock/earnings 키워드
const CN_TECH_URL = "https://news.google.com/rss/search?q=(Tencent+OR+Alibaba+OR+Baidu+OR+Xiaomi+OR+BYD)+(stock+OR+earnings+OR+price+OR+%22share+price%22+OR+target)&hl=en&gl=US&ceid=US:en&when=2d";

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

async function fetchSection(url, limit) {
  const items = await fetchRss(url, limit);
  return items.map((n) => ({ ...n, originalTitle: n.title, translated: false }));
}

export async function buildNews(env, { limit = 5 } = {}) {
  const [krRes, usRes, aiRes, krTechRes, usTechRes, cnTechRes] = await Promise.allSettled([
    fetchSection(KR_URL, limit),
    fetchSection(US_URL, limit),
    fetchSection(AI_URL, limit),
    fetchSection(KR_TECH_URL, limit),
    fetchSection(US_TECH_URL, limit),
    fetchSection(CN_TECH_URL, limit),
  ]);
  const pack = (r) => r.status === "fulfilled" ? r.value : { error: r.reason?.message || String(r.reason) };
  return {
    generatedAt: new Date().toISOString(),
    kr: pack(krRes),
    us: pack(usRes),
    ai: pack(aiRes),
    kr_tech: pack(krTechRes),
    us_tech: pack(usTechRes),
    cn_tech: pack(cnTechRes),
  };
}
