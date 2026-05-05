const YAHOO_BASE = "https://query1.finance.yahoo.com/v7/finance/quote";

export async function fetchYahooQuote(symbol) {
  const url = `${YAHOO_BASE}?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    cf: { cacheTtl: 60, cacheEverything: true },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; mp1-worker/1.0)" },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  const json = await res.json();
  const q = json?.quoteResponse?.result?.[0];
  if (!q) throw new Error(`Yahoo ${symbol} no result`);
  const value = q.regularMarketPrice;
  const prev = q.regularMarketPreviousClose;
  if (!Number.isFinite(value) || !Number.isFinite(prev)) {
    throw new Error(`Yahoo ${symbol} invalid values`);
  }
  const ts = q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : new Date().toISOString();
  return { date: ts, value, prev };
}
