import { fetchFred, fetchFredYoY } from "./sources/fred.js";
import { fetchEcos, fetchEcosYoY } from "./sources/ecos.js";
import { fetchYahooQuote } from "./sources/yahoo.js";
import { fetchCoinGeckoPrice } from "./sources/coingecko.js";

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
  const obs = await fetchEcos("721Y001", "5050000", "D", env, { count: 30 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "kr_10y", region: "KR", label: "한국 10년 국채", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildUs10y(env) {
  const obs = await fetchFred("DGS10", env, { limit: 5 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "us_10y", region: "US", label: "美 10년 국채", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildKrUnemp(env) {
  const obs = await fetchEcos("901Y027", "I61E", "M", env, { count: 6 });
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
  { id: "sp500", fn: buildSp500 },
  { id: "usd_krw", fn: buildUsdKrw },
  { id: "gold", fn: buildGold },
  { id: "silver", fn: buildSilver },
  { id: "copper", fn: buildCopper },
  { id: "btc", fn: buildBitcoin },
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
    "usd_krw", "us_kr_spread", "kospi", "sp500",
    "kr_base_rate", "us_fed_funds", "kr_10y", "us_10y",
    "kr_cpi_yoy", "us_cpi_yoy", "kr_unemp", "us_unemp",
    "gold", "silver", "copper", "btc",
  ];
  const items = order.map((id) => byId[id] || { id, error: "missing" });
  return { generatedAt: new Date().toISOString(), items };
}
