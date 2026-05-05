const CG_BASE = "https://api.coingecko.com/api/v3/simple/price";

export async function fetchCoinGeckoPrice(coinId, vs = "usd") {
  const url = `${CG_BASE}?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true&include_last_updated_at=true`;
  const res = await fetch(url, {
    cf: { cacheTtl: 60, cacheEverything: true },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CoinGecko ${coinId} HTTP ${res.status}`);
  const json = await res.json();
  const data = json?.[coinId];
  if (!data) throw new Error(`CoinGecko ${coinId} no data`);
  const value = data[vs];
  const change24h = data[`${vs}_24h_change`];
  if (!Number.isFinite(value)) throw new Error(`CoinGecko ${coinId} invalid value`);
  const prev = Number.isFinite(change24h) ? value / (1 + change24h / 100) : null;
  const ts = Number.isFinite(data.last_updated_at)
    ? new Date(data.last_updated_at * 1000).toISOString()
    : new Date().toISOString();
  return { date: ts, value, prev };
}
