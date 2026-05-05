const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export async function fetchYahooQuote(symbol) {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    cf: { cacheTtl: 60, cacheEverything: true },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; mp1-worker/1.0)" },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol} no result`);
  const meta = result.meta || {};
  const value = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose ?? meta.previousClose;
  if (!Number.isFinite(value) || !Number.isFinite(prev)) {
    throw new Error(`Yahoo ${symbol} invalid values`);
  }
  const ts = Number.isFinite(meta.regularMarketTime)
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : new Date().toISOString();
  return { date: ts, value, prev };
}
