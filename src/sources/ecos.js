const ECOS_BASE = "https://ecos.bok.or.kr/api/StatisticSearch";

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function periodRange(freq, count) {
  const now = new Date();
  const end = [];
  const start = [];
  if (freq === "M") {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    end.push(`${y}${pad2(m)}`);
    const sy = m - count <= 0 ? y - 1 : y;
    const sm = ((m - count - 1 + 12) % 12) + 1;
    start.push(`${sy - (m - count <= -12 ? 1 : 0)}${pad2(sm)}`);
  } else if (freq === "D") {
    end.push(`${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`);
    const past = new Date(now.getTime() - count * 24 * 60 * 60 * 1000);
    start.push(`${past.getUTCFullYear()}${pad2(past.getUTCMonth() + 1)}${pad2(past.getUTCDate())}`);
  }
  return { start: start[0], end: end[0] };
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
  const obs = await fetchEcos(tableCode, itemCode, "M", env, { count: 14 });
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
