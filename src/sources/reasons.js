// Per-card "왜 움직였나" search queries → top Google News headline.
// Used to add a one-line reason under cards that are alerting (큰 변동).
const QUERIES = {
  // 매크로
  kospi:        { q: "KOSPI 코스피 증시", ko: true },
  kosdaq:       { q: "KOSDAQ 코스닥 증시", ko: true },
  sp500:        { q: "S&P 500 stock market" },
  nasdaq:       { q: "NASDAQ index" },
  vix:          { q: "VIX volatility index" },
  usd_krw:      { q: "원달러 환율 USD KRW", ko: true },
  kr_base_rate: { q: "한국은행 기준금리", ko: true },
  us_fed_funds: { q: "Fed funds rate FOMC" },
  kr_10y:       { q: "한국 10년 국채 금리", ko: true },
  us_10y:       { q: "US 10-year treasury yield" },
  kr_cpi_yoy:   { q: "한국 소비자물가 CPI", ko: true },
  us_cpi_yoy:   { q: "US CPI inflation report" },
  kr_unemp:     { q: "한국 실업률 고용", ko: true },
  us_unemp:     { q: "US unemployment rate jobs report" },
  gold:         { q: "gold price ounce" },
  silver:       { q: "silver price" },
  copper:       { q: "copper price" },
  btc:          { q: "Bitcoin BTC price" },
  // 빅테크
  samsung:      { q: "삼성전자 주가", ko: true },
  sk_hynix:     { q: "SK하이닉스 주가", ko: true },
  naver:        { q: "네이버 NAVER 주가", ko: true },
  kakao:        { q: "카카오 Kakao 주가", ko: true },
  lg_energy:    { q: "LG에너지솔루션 주가", ko: true },
  apple:        { q: "Apple AAPL stock" },
  microsoft:    { q: "Microsoft MSFT stock" },
  nvidia:       { q: "NVIDIA NVDA stock" },
  google:       { q: "Alphabet GOOGL stock" },
  amazon:       { q: "Amazon AMZN stock" },
  tencent:      { q: "Tencent 0700 HK stock" },
  alibaba:      { q: "Alibaba BABA stock" },
  baidu:        { q: "Baidu stock" },
  xiaomi:       { q: "Xiaomi 1810 HK stock" },
  byd:          { q: "BYD stock 1211" },
};

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
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

function reasonUrl(q, ko) {
  const base = "https://news.google.com/rss/search";
  const locale = ko
    ? "hl=ko&gl=KR&ceid=KR:ko"
    : "hl=en&gl=US&ceid=US:en";
  return `${base}?q=${encodeURIComponent(q)}&when=2d&${locale}`;
}

async function translateToKo(text, env) {
  if (!env?.AI || !text) return null;
  try {
    const res = await env.AI.run("@cf/meta/m2m100-1.2b", {
      text, source_lang: "english", target_lang: "korean",
    });
    const ko = res?.translated_text;
    if (ko && typeof ko === "string" && ko.trim() && ko.trim() !== text.trim()) return ko.trim();
    return null;
  } catch { return null; }
}

async function fetchOne(id, env) {
  const def = QUERIES[id];
  if (!def) return null;
  try {
    const res = await fetch(reasonUrl(def.q, def.ko), {
      cf: { cacheTtl: 600, cacheEverything: true },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; mp1-worker/1.0)" },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const m = /<item>([\s\S]*?)<\/item>/.exec(xml);
    if (!m) return null;
    const block = m[1];
    let title = unwrapCdata(extract(block, "title"));
    const link = unwrapCdata(extract(block, "link"));
    const source = unwrapCdata(extract(block, "source"));
    let translated = false;
    if (!def.ko && title) {
      const ko = await translateToKo(title, env);
      if (ko) { title = ko; translated = true; }
    }
    return { headline: title, link, source, translated };
  } catch {
    return null;
  }
}

export async function buildReasonsFor(ids, env, { batch = 5 } = {}) {
  const out = {};
  for (let i = 0; i < ids.length; i += batch) {
    const chunk = ids.slice(i, i + batch);
    const res = await Promise.all(chunk.map((id) => fetchOne(id, env)));
    chunk.forEach((id, j) => { if (res[j] && res[j].headline) out[id] = res[j]; });
  }
  return out;
}
