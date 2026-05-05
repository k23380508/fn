const ECOS_BASE = "https://ecos.bok.or.kr/api/StatisticSearch";

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function periodRange(freq, count) {
  const now = new Date();
  if (freq === "M") {
    const yEnd = now.getUTCFullYear();
    const mEnd = now.getUTCMonth() + 1;
    const totalEnd = yEnd * 12 + (mEnd - 1);
    const totalStart = totalEnd - (count - 1);
    const yStart = Math.floor(totalStart / 12);
    const mStart = (totalStart % 12) + 1;
    return { start: `${yStart}${pad2(mStart)}`, end: `${yEnd}${pad2(mEnd)}` };
  }
  if (freq === "D") {
    const end = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
    const past = new Date(now.getTime() - count * 24 * 60 * 60 * 1000);
    const start = `${past.getUTCFullYear()}${pad2(past.getUTCMonth() + 1)}${pad2(past.getUTCDate())}`;
    return { start, end };
  }
  if (freq === "Y") {
    const yEnd = now.getUTCFullYear();
    return { start: `${yEnd - count + 1}`, end: `${yEnd}` };
  }
  throw new Error(`unsupported freq: ${freq}`);
}

export async function fetchEcos(tableCode, itemCode, freq, env, { count = 24 } = {}) {
  if (!env.ECOS_API_KEY) throw new Error("ECOS_API_KEY not set");
  const { start, end } = periodRange(freq, count);
  const url = `${ECOS_BASE}/${env.ECOS_API_KEY}/json/kr/1/${count}/${tableCode}/${freq}/${start}/${end}/${itemCode}`;
  const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`ECOS ${tableCode}/${itemCode} HTTP ${res.status}`);
  const json = await res.json();
  if (json.RESULT) throw new Error(`ECOS error: ${json.RESULT.MESSAGE}`);
  const rows = json?.StatisticSearch?.row || [];
  if (!rows.length) throw new Error(`ECOS ${tableCode}/${itemCode} empty`);
  return rows
    .map((r) => ({ date: r.TIME, value: Number(r.DATA_VALUE) }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function fetchEcosYoY(tableCode, itemCode, env) {
  const obs = await fetchEcos(tableCode, itemCode, "M", env, { count: 16 });
  if (obs.length < 13) throw new Error(`ECOS ${tableCode}/${itemCode} insufficient data for YoY`);
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
