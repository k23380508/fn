const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export async function fetchYahooQuote(symbol, { range = "5d", interval = "1d" } = {}) {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
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
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const series = timestamps
    .map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), value: closes[i] }))
    .filter((p) => Number.isFinite(p.value));
  return { date: ts, value, prev, series };
}
