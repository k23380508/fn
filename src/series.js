import { fetchFred } from "./sources/fred.js";
import { fetchEcos } from "./sources/ecos.js";
import { fetchYahooQuote } from "./sources/yahoo.js";

const RANGE_DAYS = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366, "5Y": 1830 };
const RANGE_MONTHS = { "1M": 2, "3M": 4, "6M": 7, "1Y": 13, "5Y": 61 };
const RANGE_TO_YAHOO = { "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y", "5Y": "5y" };

export const RANGES = Object.keys(RANGE_DAYS);

export const SERIES_REGISTRY = {
  usd_krw:      { source: "yahoo", symbol: "KRW=X" },
  kospi:        { source: "yahoo", symbol: "^KS11" },
  kosdaq:       { source: "yahoo", symbol: "^KQ11" },
  sp500:        { source: "fred", id: "SP500", freq: "D" },
  nasdaq:       { source: "yahoo", symbol: "^IXIC" },
  vix:          { source: "yahoo", symbol: "^VIX" },
  kr_cpi_yoy:   { source: "ecos", table: "901Y009", item: "0", freq: "M", computeYoy: true },
  us_cpi_yoy:   { source: "fred", id: "CPIAUCSL", freq: "M", computeYoy: true },
  kr_unemp:     { source: "fred", id: "LRHUTTTTKRM156S", freq: "M" },
  us_unemp:     { source: "fred", id: "UNRATE", freq: "M" },
  kr_m2:        { source: "ecos", table: "161Y005", item: "BBHS00", freq: "M", scale: 0.001 },
  us_m2:        { source: "fred", id: "M2SL", freq: "M", scale: 0.001 },
  gold:         { source: "yahoo", symbol: "GC=F" },
  silver:       { source: "yahoo", symbol: "SI=F" },
  copper:       { source: "yahoo", symbol: "HG=F" },
  btc:          { source: "yahoo", symbol: "BTC-USD" },
  samsung:      { source: "yahoo", symbol: "005930.KS" },
  sk_hynix:     { source: "yahoo", symbol: "000660.KS" },
  lg_energy:    { source: "yahoo", symbol: "373220.KS" },
  samsung_bio:  { source: "yahoo", symbol: "207940.KS" },
  hyundai:      { source: "yahoo", symbol: "005380.KS" },
  kia:          { source: "yahoo", symbol: "000270.KS" },
  naver:        { source: "yahoo", symbol: "035420.KS" },
  celltrion:    { source: "yahoo", symbol: "068270.KS" },
  posco:        { source: "yahoo", symbol: "005490.KS" },
  kakao:        { source: "yahoo", symbol: "035720.KS" },
  hanwha_aero:  { source: "yahoo", symbol: "012450.KS" },
  ecopro_bm:    { source: "yahoo", symbol: "247540.KQ" },
  alteogen:     { source: "yahoo", symbol: "196170.KQ" },
  apple:        { source: "yahoo", symbol: "AAPL" },
  microsoft:    { source: "yahoo", symbol: "MSFT" },
  nvidia:       { source: "yahoo", symbol: "NVDA" },
  google:       { source: "yahoo", symbol: "GOOGL" },
  amazon:       { source: "yahoo", symbol: "AMZN" },
  meta:         { source: "yahoo", symbol: "META" },
  tesla:        { source: "yahoo", symbol: "TSLA" },
  broadcom:     { source: "yahoo", symbol: "AVGO" },
  berkshire:    { source: "yahoo", symbol: "BRK-B" },
  jpmorgan:     { source: "yahoo", symbol: "JPM" },
  amd:          { source: "yahoo", symbol: "AMD" },
  palantir:     { source: "yahoo", symbol: "PLTR" },
  arq_etf:      { source: "yahoo", symbol: "ARKQ" },
  gld_etf:      { source: "yahoo", symbol: "GLD" },
  smrf_etf:     { source: "yahoo", symbol: "SMRF" },
  xlc_etf:      { source: "yahoo", symbol: "XLC" },
  xlu_etf:      { source: "yahoo", symbol: "XLU" },
};

function computeYoy(ascSeries) {
  const out = [];
  for (let i = 12; i < ascSeries.length; i++) {
    const prev = ascSeries[i - 12].value;
    if (prev) out.push({ date: ascSeries[i].date, value: ((ascSeries[i].value - prev) / prev) * 100 });
  }
  return out;
}

export async function fetchSeries(id, range, env) {
  const def = SERIES_REGISTRY[id];
  if (!def) throw new Error(`unknown series id: ${id}`);
  if (!RANGE_DAYS[range]) throw new Error(`unknown range: ${range}`);

  const scale = Number.isFinite(def.scale) ? def.scale : 1;
  if (def.source === "fred") {
    const baseLimit = def.freq === "D" ? RANGE_DAYS[range] : RANGE_MONTHS[range];
    const limit = baseLimit + (def.computeYoy ? 12 : 0);
    const obs = await fetchFred(def.id, env, { limit });
    const asc = obs.map((o) => ({ date: o.date, value: o.value * scale })).reverse();
    return def.computeYoy ? computeYoy(asc) : asc;
  }
  if (def.source === "ecos") {
    const baseCount = def.freq === "D" ? RANGE_DAYS[range] : RANGE_MONTHS[range];
    const count = baseCount + (def.computeYoy ? 12 : 0);
    const obs = await fetchEcos(def.table, def.item, def.freq, env, { count });
    const asc = obs.map((o) => ({ date: o.date, value: o.value * scale })).reverse();
    return def.computeYoy ? computeYoy(asc) : asc;
  }
  if (def.source === "yahoo") {
    const yahooRange = RANGE_TO_YAHOO[range] || "1mo";
    const q = await fetchYahooQuote(def.symbol, { range: yahooRange });
    return q.series || [];
  }
  throw new Error(`unsupported source: ${def.source}`);
}
