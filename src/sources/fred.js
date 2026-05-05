const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

export async function fetchFred(seriesId, env, { limit = 2 } = {}) {
  if (!env.FRED_API_KEY) throw new Error("FRED_API_KEY not set");
  const url = `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}&api_key=${env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  const json = await res.json();
  const obs = (json.observations || []).filter((o) => o.value !== "." && o.value != null);
  if (!obs.length) throw new Error(`FRED ${seriesId} no observations`);
  return obs.map((o) => ({ date: o.date, value: Number(o.value) }));
}

export async function fetchFredYoY(seriesId, env) {
  if (!env.FRED_API_KEY) throw new Error("FRED_API_KEY not set");
  const url = `${FRED_BASE}?series_id=${encodeURIComponent(seriesId)}&api_key=${env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=16`;
  const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  const json = await res.json();
  const obs = (json.observations || [])
    .filter((o) => o.value !== "." && o.value != null)
    .map((o) => ({ date: o.date, value: Number(o.value) }));
  if (obs.length < 13) throw new Error(`FRED ${seriesId} insufficient data for YoY`);
  const latest = obs[0];
  const yearAgo = obs[12];
  const prev = obs[1];
  const yearAgoForPrev = obs[13];
  const yoy = ((latest.value - yearAgo.value) / yearAgo.value) * 100;
  const prevYoy = yearAgoForPrev
    ? ((prev.value - yearAgoForPrev.value) / yearAgoForPrev.value) * 100
    : null;
  return { date: latest.date, value: yoy, prev: prevYoy };
}
