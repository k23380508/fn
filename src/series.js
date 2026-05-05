import { fetchFred } from "./sources/fred.js";
import { fetchEcos } from "./sources/ecos.js";
import { fetchYahooQuote } from "./sources/yahoo.js";

const RANGE_DAYS = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366, "5Y": 1830 };
const RANGE_MONTHS = { "1M": 2, "3M": 4, "6M": 7, "1Y": 13, "5Y": 61 };
const RANGE_TO_YAHOO = { "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y", "5Y": "5y" };

export const REGISTRY = {
  fx: {
    USDKRW: { source: "fred", id: "DEXKOUS", freq: "D" },
  },
  us: {
    DFF: { source: "fred", id: "DFF", freq: "D" },
    DGS10: { source: "fred", id: "DGS10", freq: "D" },
    SP500: { source: "fred", id: "SP500", freq: "D" },
    CPIAUCSL: { source: "fred", id: "CPIAUCSL", freq: "M" },
    UNRATE: { source: "fred", id: "UNRATE", freq: "M" },
  },
  kr: {
    BASE_RATE: { source: "ecos", table: "722Y001", item: "0101000", freq: "M" },
    KTB10Y: { source: "ecos", table: "817Y002", item: "010230000", freq: "D" },
    CPI: { source: "ecos", table: "901Y009", item: "0", freq: "M" },
    UNEMP: { source: "fred", id: "LRHUTTTTKRM156S", freq: "M" },
    KOSPI: { source: "yahoo", symbol: "^KS11" },
  },
  cmd: {
    GOLD: { source: "yahoo", symbol: "GC=F" },
    SILVER: { source: "yahoo", symbol: "SI=F" },
    COPPER: { source: "yahoo", symbol: "HG=F" },
  },
  cry: {
    BTC: { source: "yahoo", symbol: "BTC-USD" },
  },
};

export async function fetchSeries(country, id, range, env) {
  const def = REGISTRY[country]?.[id];
  if (!def) throw new Error(`unknown series: ${country}/${id}`);
  if (!RANGE_DAYS[range]) throw new Error(`unknown range: ${range}`);

  if (def.source === "fred") {
    const limit = def.freq === "D" ? RANGE_DAYS[range] : RANGE_MONTHS[range];
    const obs = await fetchFred(def.id, env, { limit });
    return obs.map((o) => ({ date: o.date, value: o.value })).reverse();
  }
  if (def.source === "ecos") {
    const count = def.freq === "D" ? RANGE_DAYS[range] : RANGE_MONTHS[range];
    const obs = await fetchEcos(def.table, def.item, def.freq, env, { count });
    return obs.map((o) => ({ date: o.date, value: o.value })).reverse();
  }
  if (def.source === "yahoo") {
    const yahooRange = RANGE_TO_YAHOO[range] || "3mo";
    const q = await fetchYahooQuote(def.symbol, { range: yahooRange });
    return q.series;
  }
  throw new Error(`unsupported source: ${def.source}`);
}

export function listRegistry() {
  const out = {};
  for (const [country, items] of Object.entries(REGISTRY)) {
    out[country] = Object.keys(items);
  }
  return out;
}
