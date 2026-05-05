import { fetchFred, fetchFredYoY } from "./sources/fred.js";
import { fetchEcos, fetchEcosYoY } from "./sources/ecos.js";
import { fetchYahooQuote } from "./sources/yahoo.js";
import { fetchCoinGeckoPrice } from "./sources/coingecko.js";
import { fetchSeries, SERIES_REGISTRY } from "./series.js";

const STATS_WINDOWS = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366 };

function computeStats(series) {
  if (!Array.isArray(series) || !series.length) return null;
  const now = Date.now();
  const out = {};
  for (const label of Object.keys(STATS_WINDOWS)) {
    const days = STATS_WINDOWS[label];
    const cutoff = now - days * 86400000;
    let hi = -Infinity, lo = Infinity, hiDate = null, loDate = null, count = 0;
    for (const p of series) {
      const t = new Date(p.date).getTime();
      if (!Number.isFinite(t) || t < cutoff || !Number.isFinite(p.value)) continue;
      count++;
      if (p.value > hi) { hi = p.value; hiDate = p.date; }
      if (p.value < lo) { lo = p.value; loDate = p.date; }
    }
    if (count > 0) out[label] = { hi, lo, hiDate, loDate, count };
  }
  return Object.keys(out).length ? out : null;
}

async function enrichWithStats(items, env) {
  const FALLBACK_RANGES = ["1Y", "6M", "3M", "1M"];
  await Promise.all(items.map(async (item) => {
    if (item.error || item.stats || !SERIES_REGISTRY[item.id]) return; // skip if already populated by builder
    for (const r of FALLBACK_RANGES) {
      try {
        const series = await fetchSeries(item.id, r, env);
        const stats = computeStats(series);
        if (stats && Object.keys(stats).length) {
          item.stats = stats;
          return;
        }
      } catch {
        // try next range
      }
    }
    // best-effort; leave stats undefined if all ranges fail
  }));
}

function deltaPair(latest, prev) {
  if (!Number.isFinite(latest) || !Number.isFinite(prev)) return null;
  return { abs: latest - prev, pct: prev === 0 ? null : ((latest - prev) / prev) * 100 };
}

function pickLatestPrev(series) {
  return { latest: series[0]?.value, prev: series[1]?.value, date: series[0]?.date };
}

async function buildKrBaseRate(env) {
  const obs = await fetchEcos("722Y001", "0101000", "M", env, { count: 24 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "kr_base_rate", region: "KR", label: "한국 기준금리", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildUsFedFunds(env) {
  const obs = await fetchFred("DFF", env, { limit: 2 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "us_fed_funds", region: "US", label: "美 연준 기준금리 (DFF)", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildKrCpiYoy(env) {
  const yoy = await fetchEcosYoY("901Y009", "0", env);
  return { id: "kr_cpi_yoy", region: "KR", label: "한국 CPI (전년동월비)", unit: "%", value: yoy.value, prev: yoy.prev, delta: deltaPair(yoy.value, yoy.prev), date: yoy.date };
}

async function buildUsCpiYoy(env) {
  const yoy = await fetchFredYoY("CPIAUCSL", env);
  return { id: "us_cpi_yoy", region: "US", label: "美 CPI (YoY)", unit: "%", value: yoy.value, prev: yoy.prev, delta: deltaPair(yoy.value, yoy.prev), date: yoy.date };
}

async function buildKr10y(env) {
  const obs = await fetchEcos("817Y002", "010230000", "D", env, { count: 30 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "kr_10y", region: "KR", label: "한국 10년 국채", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildUs10y(env) {
  const obs = await fetchFred("DGS10", env, { limit: 5 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "us_10y", region: "US", label: "美 10년 국채", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildKrUnemp(env) {
  const obs = await fetchFred("LRHUTTTTKRM156S", env, { limit: 5 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "kr_unemp", region: "KR", label: "한국 실업률", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildUsUnemp(env) {
  const obs = await fetchFred("UNRATE", env, { limit: 2 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "us_unemp", region: "US", label: "美 실업률", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildKospi() {
  const q = await fetchYahooQuote("^KS11");
  return { id: "kospi", region: "KR", label: "KOSPI", unit: "", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
}

async function buildKosdaq() {
  const q = await fetchYahooQuote("^KQ11");
  return { id: "kosdaq", region: "KR", label: "KOSDAQ", unit: "", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
}

async function buildNasdaq() {
  const q = await fetchYahooQuote("^IXIC");
  return { id: "nasdaq", region: "US", label: "NASDAQ", unit: "", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
}

async function buildVix() {
  const q = await fetchYahooQuote("^VIX");
  return { id: "vix", region: "US", label: "VIX (변동성)", unit: "", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
}

async function buildSp500(env) {
  const obs = await fetchFred("SP500", env, { limit: 5 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "sp500", region: "US", label: "S&P 500", unit: "", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildUsdKrw(env) {
  const obs = await fetchFred("DEXKOUS", env, { limit: 5 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "usd_krw", region: "FX", label: "USD/KRW", unit: "원", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildGold() {
  const q = await fetchYahooQuote("GC=F");
  return { id: "gold", region: "CMD", label: "금 (Gold, $/oz)", unit: "$", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
}

async function buildSilver() {
  const q = await fetchYahooQuote("SI=F");
  return { id: "silver", region: "CMD", label: "은 (Silver, $/oz)", unit: "$", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
}

async function buildCopper() {
  const q = await fetchYahooQuote("HG=F");
  return { id: "copper", region: "CMD", label: "동 (Copper, $/lb)", unit: "$", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
}

async function buildBitcoin() {
  try {
    const q = await fetchYahooQuote("BTC-USD");
    return { id: "btc", region: "CRY", label: "비트코인 (BTC/USD)", unit: "$", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
  } catch (e) {
    const q = await fetchCoinGeckoPrice("bitcoin");
    return { id: "btc", region: "CRY", label: "비트코인 (BTC/USD)", unit: "$", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
  }
}

const BIGTECH = [
  { id: "samsung",   region: "KR_TECH", symbol: "005930.KS", label: "삼성전자",            unit: "원" },
  { id: "sk_hynix",  region: "KR_TECH", symbol: "000660.KS", label: "SK하이닉스",          unit: "원" },
  { id: "naver",     region: "KR_TECH", symbol: "035420.KS", label: "네이버",              unit: "원" },
  { id: "kakao",     region: "KR_TECH", symbol: "035720.KS", label: "카카오",              unit: "원" },
  { id: "lg_energy", region: "KR_TECH", symbol: "373220.KS", label: "LG에너지솔루션",      unit: "원" },
  { id: "apple",     region: "US_TECH", symbol: "AAPL",      label: "Apple",              unit: "$" },
  { id: "microsoft", region: "US_TECH", symbol: "MSFT",      label: "Microsoft",          unit: "$" },
  { id: "nvidia",    region: "US_TECH", symbol: "NVDA",      label: "NVIDIA",             unit: "$" },
  { id: "google",    region: "US_TECH", symbol: "GOOGL",     label: "Alphabet (Google)",  unit: "$" },
  { id: "amazon",    region: "US_TECH", symbol: "AMZN",      label: "Amazon",             unit: "$" },
  { id: "tencent",   region: "CN",      symbol: "0700.HK",   label: "텐센트 (Tencent)",    unit: "HK$" },
  { id: "alibaba",   region: "CN",      symbol: "BABA",      label: "알리바바 (Alibaba)",  unit: "$" },
  { id: "baidu",     region: "CN",      symbol: "9888.HK",   label: "바이두 (Baidu)",      unit: "HK$" },
  { id: "xiaomi",    region: "CN",      symbol: "1810.HK",   label: "샤오미 (Xiaomi)",     unit: "HK$" },
  { id: "byd",       region: "CN",      symbol: "1211.HK",   label: "BYD",                unit: "HK$" },
];

function makeBigtechBuilder(t) {
  return async () => {
    // Fetch 1y range upfront so stats can be derived from the same response
    // (avoids hitting Worker subrequest limit during enrichWithStats).
    // Note: with range=1y, q.prev = chartPreviousClose ≈ 1 year ago value, NOT
    // the previous trading day. Recompute prev from the last two series points.
    const q = await fetchYahooQuote(t.symbol, { range: "1y" });
    const series = q.series || [];
    const value = q.value;
    const prev = series.length >= 2 ? series[series.length - 2].value : q.prev;
    const out = { id: t.id, region: t.region, label: t.label, unit: t.unit, value, prev, delta: deltaPair(value, prev), date: q.date };
    const stats = computeStats(series);
    if (stats) out.stats = stats;
    return out;
  };
}

function buildSpread(usFedRow, krBaseRow) {
  if (!usFedRow || !krBaseRow || usFedRow.error || krBaseRow.error) {
    throw new Error("spread depends on US Fed and KR base — one missing");
  }
  const value = usFedRow.value - krBaseRow.value;
  const prev = (usFedRow.prev ?? null) !== null && (krBaseRow.prev ?? null) !== null
    ? usFedRow.prev - krBaseRow.prev
    : null;
  return {
    id: "us_kr_spread",
    region: "FX",
    label: "한미 금리차 (US − KR)",
    unit: "%p",
    value,
    prev,
    delta: deltaPair(value, prev),
    date: usFedRow.date,
  };
}

const BUILDERS = [
  { id: "kr_base_rate", fn: buildKrBaseRate },
  { id: "us_fed_funds", fn: buildUsFedFunds },
  { id: "kr_cpi_yoy", fn: buildKrCpiYoy },
  { id: "us_cpi_yoy", fn: buildUsCpiYoy },
  { id: "kr_10y", fn: buildKr10y },
  { id: "us_10y", fn: buildUs10y },
  { id: "kr_unemp", fn: buildKrUnemp },
  { id: "us_unemp", fn: buildUsUnemp },
  { id: "kospi", fn: buildKospi },
  { id: "kosdaq", fn: buildKosdaq },
  { id: "sp500", fn: buildSp500 },
  { id: "nasdaq", fn: buildNasdaq },
  { id: "vix", fn: buildVix },
  { id: "usd_krw", fn: buildUsdKrw },
  { id: "gold", fn: buildGold },
  { id: "silver", fn: buildSilver },
  { id: "copper", fn: buildCopper },
  { id: "btc", fn: buildBitcoin },
  ...BIGTECH.map((t) => ({ id: t.id, fn: makeBigtechBuilder(t) })),
];

export async function buildSnapshot(env) {
  const settled = await Promise.allSettled(BUILDERS.map((b) => b.fn(env)));
  const byId = {};
  settled.forEach((r, i) => {
    const id = BUILDERS[i].id;
    if (r.status === "fulfilled") byId[id] = r.value;
    else byId[id] = { id, error: r.reason?.message || String(r.reason) };
  });

  try {
    byId.us_kr_spread = buildSpread(byId.us_fed_funds, byId.kr_base_rate);
  } catch (e) {
    byId.us_kr_spread = { id: "us_kr_spread", error: e.message };
  }

  const order = [
    "usd_krw", "us_kr_spread",
    "kospi", "kosdaq", "sp500", "nasdaq", "vix",
    "kr_base_rate", "us_fed_funds", "kr_10y", "us_10y",
    "kr_cpi_yoy", "us_cpi_yoy", "kr_unemp", "us_unemp",
    "gold", "silver", "copper", "btc",
    "samsung", "sk_hynix", "naver", "kakao", "lg_energy",
    "apple", "microsoft", "nvidia", "google", "amazon",
    "tencent", "alibaba", "baidu", "xiaomi", "byd",
  ];
  const items = order.map((id) => byId[id] || { id, error: "missing" });
  await enrichWithStats(items, env);
  return { generatedAt: new Date().toISOString(), items };
}
