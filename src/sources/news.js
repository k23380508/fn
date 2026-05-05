const KR_URL = "https://news.google.com/rss/search?q=%EA%B2%BD%EC%A0%9C+OR+%EC%A6%9D%EC%8B%9C+OR+%EA%B8%88%EC%9C%B5+OR+%ED%99%98%EC%9C%A8&hl=ko&gl=KR&ceid=KR:ko";
const US_URL = "https://news.google.com/rss/search?q=economy+OR+stock+OR+fed+OR+market&hl=en&gl=US&ceid=US:en";

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
    cf: { cacheTtl: 900, cacheEverything: true },
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

export async function buildNews({ limit = 5 } = {}) {
  const [krRes, usRes] = await Promise.allSettled([
    fetchRss(KR_URL, limit),
    fetchRss(US_URL, limit),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    kr: krRes.status === "fulfilled" ? krRes.value : { error: krRes.reason?.message || String(krRes.reason) },
    us: usRes.status === "fulfilled" ? usRes.value : { error: usRes.reason?.message || String(usRes.reason) },
  };
}
