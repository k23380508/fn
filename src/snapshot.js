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
    let startValue = null, startDate = null, endValue = null;
    for (const p of series) {
      const t = new Date(p.date).getTime();
      if (!Number.isFinite(t) || t < cutoff || !Number.isFinite(p.value)) continue;
      count++;
      if (p.value > hi) { hi = p.value; hiDate = p.date; }
      if (p.value < lo) { lo = p.value; loDate = p.date; }
      if (startValue === null) { startValue = p.value; startDate = p.date; }
      endValue = p.value;
    }
    if (count > 0) {
      const changePct = (Number.isFinite(startValue) && startValue !== 0 && Number.isFinite(endValue))
        ? ((endValue - startValue) / startValue) * 100
        : null;
      out[label] = { hi, lo, hiDate, loDate, count, startValue, startDate, endValue, changePct };
    }
  }
  return Object.keys(out).length ? out : null;
}

// 무료 plan subrequest 50 한도 보호 — ETF 5개 추가 후 enrich에서 추가 fetch
// 공간 부족. cpi/unemp stats(range bar)는 trade-off로 비활성. 빌더가 처리하지
// 않는 다른 카드(향후 추가)는 enrich가 fallback으로 채움.
const ENRICH_SKIP_IDS = new Set(["kr_cpi_yoy", "us_cpi_yoy", "kr_unemp", "us_unemp"]);

async function enrichWithStats(items, env) {
  const FALLBACK_RANGES = ["1Y", "6M", "3M", "1M"];
  await Promise.all(items.map(async (item) => {
    if (item.error || item.stats || !SERIES_REGISTRY[item.id]) return;
    if (ENRICH_SKIP_IDS.has(item.id)) return;
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
  }));
}

function deltaPair(latest, prev) {
  if (!Number.isFinite(latest) || !Number.isFinite(prev)) return null;
  return { abs: latest - prev, pct: prev === 0 ? null : ((latest - prev) / prev) * 100 };
}

function pickLatestPrev(series) {
  return { latest: series[0]?.value, prev: series[1]?.value, date: series[0]?.date };
}

// 금리 카드용 변경 이력: 최신 + 직전 변경 2회 (DFF는 daily라 같은 값 반복 →
// 다른 값으로 바뀐 시점만 추출). desc obs (최신 first) 가정.
function rateHistory(obs, n = 3) {
  const out = [];
  for (let i = 0; i < obs.length && out.length < n; i++) {
    if (out.length === 0 || out[out.length - 1].value !== obs[i].value) {
      out.push({ date: obs[i].date, value: obs[i].value });
    }
  }
  return out;
}

// CPI YoY 카드용 이력: 최신 n개월의 YoY 값 (dedup 없음 — 매월이 별도 데이터).
// obs는 monthly desc, obs[i].value=원지수. obs[i] vs obs[i+12]로 YoY 계산.
// n=3이면 obs[14]까지 필요 (16개 fetch면 안전).
function cpiHistory(obs, n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const cur = obs[i];
    const yearAgo = obs[i + 12];
    if (!cur || !yearAgo || !yearAgo.value) continue;
    const yoy = ((cur.value - yearAgo.value) / yearAgo.value) * 100;
    out.push({ date: cur.date, value: yoy });
  }
  return out;
}

async function buildKrBaseRate(env) {
  const obs = await fetchEcos("722Y001", "0101000", "M", env, { count: 24 });
  const { latest, prev, date } = pickLatestPrev(obs);
  const out = { id: "kr_base_rate", region: "KR", label: "한국 기준금리", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date, history: rateHistory(obs, 3) };
  // ECOS yyyymm → ISO 변환 + asc 정렬 (computeStats는 startValue=window 첫 값 = 가장 오래된)
  const ascSeries = obs.map((o) => ({
    date: /^\d{6}$/.test(o.date) ? `${o.date.slice(0,4)}-${o.date.slice(4,6)}-01` : o.date,
    value: o.value,
  })).slice().reverse();
  const stats = computeStats(ascSeries);
  if (stats) out.stats = stats;
  return out;
}

async function buildUsFedFunds(env) {
  const obs = await fetchFred("DFF", env, { limit: 200 });
  const { latest, prev, date } = pickLatestPrev(obs);
  const out = { id: "us_fed_funds", region: "US", label: "美 연준 기준금리 (DFF)", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date, history: rateHistory(obs, 3) };
  const ascSeries = obs.map((o) => ({ date: o.date, value: o.value })).slice().reverse();
  const stats = computeStats(ascSeries);
  if (stats) out.stats = stats;
  return out;
}

function computeYoYFromObs(obs) {
  // obs: desc (최신 first). YoY = (latest - 12개월전) / 12개월전 * 100
  const latest = obs[0];
  const yearAgo = obs[12];
  const prev = obs[1];
  const yearAgoPrev = obs[13];
  if (!latest || !yearAgo || !yearAgo.value) return { value: null, prev: null, date: latest?.date };
  const value = ((latest.value - yearAgo.value) / yearAgo.value) * 100;
  const prevVal = (prev && yearAgoPrev && yearAgoPrev.value)
    ? ((prev.value - yearAgoPrev.value) / yearAgoPrev.value) * 100
    : null;
  return { value, prev: prevVal, date: latest.date };
}

async function buildKrCpiYoy(env) {
  // YoY 계산용 16개월치 한 번에 fetch (이전엔 fetchEcosYoY + fetchEcos 2회 호출)
  const obs = await fetchEcos("901Y009", "0", "M", env, { count: 16 });
  const yoy = computeYoYFromObs(obs);
  return { id: "kr_cpi_yoy", region: "KR", label: "한국 CPI (전년동월비)", unit: "%", value: yoy.value, prev: yoy.prev, delta: deltaPair(yoy.value, yoy.prev), date: yoy.date, history: cpiHistory(obs, 3) };
}

async function buildUsCpiYoy(env) {
  const obs = await fetchFred("CPIAUCSL", env, { limit: 16 });
  const yoy = computeYoYFromObs(obs);
  return { id: "us_cpi_yoy", region: "US", label: "美 CPI (YoY)", unit: "%", value: yoy.value, prev: yoy.prev, delta: deltaPair(yoy.value, yoy.prev), date: yoy.date, history: cpiHistory(obs, 3) };
}

async function buildKr10y(env) {
  // 1Y daily for stats (yyyymmdd date) — stats 직접 채워서 enrichWithStats skip
  const obs = await fetchEcos("817Y002", "010230000", "D", env, { count: 365 });
  const { latest, prev, date } = pickLatestPrev(obs);
  const out = { id: "kr_10y", region: "KR", label: "한국 10년 국채", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date, history: rateHistory(obs, 3) };
  // ECOS yyyymmdd → ISO + asc (오래된 → 최신)
  const ascSeries = obs.map((o) => ({
    date: /^\d{8}$/.test(o.date) ? `${o.date.slice(0,4)}-${o.date.slice(4,6)}-${o.date.slice(6,8)}` : o.date,
    value: o.value,
  })).slice().reverse();
  const stats = computeStats(ascSeries);
  if (stats) out.stats = stats;
  return out;
}

async function buildUs10y(env) {
  const obs = await fetchFred("DGS10", env, { limit: 365 });
  const { latest, prev, date } = pickLatestPrev(obs);
  const out = { id: "us_10y", region: "US", label: "美 10년 국채", unit: "%", value: latest, prev, delta: deltaPair(latest, prev), date, history: rateHistory(obs, 3) };
  const ascSeries = obs.map((o) => ({ date: o.date, value: o.value })).slice().reverse();
  const stats = computeStats(ascSeries);
  if (stats) out.stats = stats;
  return out;
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

// M2 통화량: 표시 단위 "조원"/"조$". FRED M2SL은 십억$ 단위, ECOS 101Y004 BBHA00은
// 십억원 단위 — 둘 다 /1000 스케일링해 조원/조$ (10^12) 표시. 16개월 fetch로 stats 채움.
async function buildKrM2(env) {
  // FRED MYAGM2KRM189S는 2017년 5월에서 중단 → ECOS 신지표 직접 호출
  // 161Y005 BBHS00 = M2(평잔, 계절조정계열), 단위 십억원, 신지표 (101Y004는 구지표로 2004년 종료)
  const obs = await fetchEcos("161Y005", "BBHS00", "M", env, { count: 16 });
  const scaled = obs.map((o) => ({ date: o.date, value: Number.isFinite(o.value) ? o.value / 1000 : o.value }));
  const { latest, prev, date } = pickLatestPrev(scaled);
  const out = { id: "kr_m2", region: "KR", label: "한국 M2 (광의통화)", unit: "조원", value: latest, prev, delta: deltaPair(latest, prev), date, history: scaled.slice(0, 5) };
  // ECOS yyyymm → ISO 변환 + asc 정렬 (stats용)
  const ascSeries = scaled.map((o) => ({
    date: /^\d{6}$/.test(o.date) ? `${o.date.slice(0,4)}-${o.date.slice(4,6)}-01` : o.date,
    value: o.value,
  })).slice().reverse();
  const stats = computeStats(ascSeries);
  if (stats) out.stats = stats;
  return out;
}

async function buildUsM2(env) {
  const obs = await fetchFred("M2SL", env, { limit: 16 });
  const scaled = obs.map((o) => ({ date: o.date, value: Number.isFinite(o.value) ? o.value / 1000 : o.value }));
  const { latest, prev, date } = pickLatestPrev(scaled);
  const out = { id: "us_m2", region: "US", label: "美 M2 (광의통화)", unit: "조$", value: latest, prev, delta: deltaPair(latest, prev), date, history: scaled.slice(0, 5) };
  const stats = computeStats(scaled.slice().reverse());
  if (stats) out.stats = stats;
  return out;
}

async function buildYahooCard({ id, region, label, unit, symbol }) {
  // Single 1y fetch for value + prev + stats — keeps subrequest count low
  const q = await fetchYahooQuote(symbol, { range: "1y" });
  const series = q.series || [];
  const value = q.value;
  const prev = series.length >= 2 ? series[series.length - 2].value : q.prev;
  const out = { id, region, label, unit, value, prev, delta: deltaPair(value, prev), date: q.date };
  const stats = computeStats(series);
  if (stats) out.stats = stats;
  return out;
}

async function buildKospi() {
  return buildYahooCard({ id: "kospi", region: "KR", label: "KOSPI", unit: "", symbol: "^KS11" });
}

async function buildKosdaq() {
  return buildYahooCard({ id: "kosdaq", region: "KR", label: "KOSDAQ", unit: "", symbol: "^KQ11" });
}

async function buildNasdaq() {
  return buildYahooCard({ id: "nasdaq", region: "US", label: "NASDAQ", unit: "", symbol: "^IXIC" });
}

async function buildVix() {
  return buildYahooCard({ id: "vix", region: "US", label: "VIX (변동성)", unit: "", symbol: "^VIX" });
}

async function buildSp500(env) {
  const obs = await fetchFred("SP500", env, { limit: 5 });
  const { latest, prev, date } = pickLatestPrev(obs);
  return { id: "sp500", region: "US", label: "S&P 500", unit: "", value: latest, prev, delta: deltaPair(latest, prev), date };
}

async function buildUsdKrw() {
  return buildYahooCard({ id: "usd_krw", region: "FX", label: "USD/KRW", unit: "원", symbol: "KRW=X" });
}

async function buildGold() {
  return buildYahooCard({ id: "gold", region: "CMD", label: "금 (Gold, $/oz)", unit: "$", symbol: "GC=F" });
}

async function buildSilver() {
  return buildYahooCard({ id: "silver", region: "CMD", label: "은 (Silver, $/oz)", unit: "$", symbol: "SI=F" });
}

async function buildCopper() {
  return buildYahooCard({ id: "copper", region: "CMD", label: "동 (Copper, $/lb)", unit: "$", symbol: "HG=F" });
}

async function buildBitcoin() {
  try {
    return await buildYahooCard({ id: "btc", region: "CRY", label: "비트코인 (BTC/USD)", unit: "$", symbol: "BTC-USD" });
  } catch (e) {
    const q = await fetchCoinGeckoPrice("bitcoin");
    return { id: "btc", region: "CRY", label: "비트코인 (BTC/USD)", unit: "$", value: q.value, prev: q.prev, delta: deltaPair(q.value, q.prev), date: q.date };
  }
}

// 한국 빅테크 표시 = (시총 top 10에서 |Δ| 큰 3개) + (변동성 풀 5에서 max gain 1, max loss 1)
// 매 snapshot 빌드(KV 90분) 시 풀 전체 fetch → render가 동적 선정.
const BIGTECH = [
  // KR_TECH 시총 top 10
  { id: "samsung",     region: "KR_TECH", symbol: "005930.KS", label: "삼성전자",            unit: "원" },
  { id: "sk_hynix",    region: "KR_TECH", symbol: "000660.KS", label: "SK하이닉스",          unit: "원" },
  { id: "lg_energy",   region: "KR_TECH", symbol: "373220.KS", label: "LG에너지솔루션",      unit: "원" },
  { id: "samsung_bio", region: "KR_TECH", symbol: "207940.KS", label: "삼성바이오로직스",     unit: "원" },
  { id: "hyundai",     region: "KR_TECH", symbol: "005380.KS", label: "현대차",              unit: "원" },
  { id: "kia",         region: "KR_TECH", symbol: "000270.KS", label: "기아",                unit: "원" },
  { id: "naver",       region: "KR_TECH", symbol: "035420.KS", label: "네이버",              unit: "원" },
  { id: "celltrion",   region: "KR_TECH", symbol: "068270.KS", label: "셀트리온",            unit: "원" },
  { id: "posco",       region: "KR_TECH", symbol: "005490.KS", label: "POSCO홀딩스",         unit: "원" },
  { id: "kakao",       region: "KR_TECH", symbol: "035720.KS", label: "카카오",              unit: "원" },
  // KR_MOVERS — 변동성 후보 풀 (XLU 한도 보호 위해 두산·크래프톤 제거, 3종 유지)
  { id: "hanwha_aero",  region: "KR_TECH", symbol: "012450.KS", label: "한화에어로스페이스",  unit: "원" },
  { id: "ecopro_bm",    region: "KR_TECH", symbol: "247540.KQ", label: "에코프로비엠",        unit: "원" },
  { id: "alteogen",     region: "KR_TECH", symbol: "196170.KQ", label: "알테오젠",            unit: "원" },
  // US_TECH 시총 top 10
  { id: "apple",     region: "US_TECH", symbol: "AAPL",  label: "Apple",                unit: "$" },
  { id: "microsoft", region: "US_TECH", symbol: "MSFT",  label: "Microsoft",            unit: "$" },
  { id: "nvidia",    region: "US_TECH", symbol: "NVDA",  label: "NVIDIA",               unit: "$" },
  { id: "google",    region: "US_TECH", symbol: "GOOGL", label: "Alphabet (Google)",    unit: "$" },
  { id: "amazon",    region: "US_TECH", symbol: "AMZN",  label: "Amazon",               unit: "$" },
  { id: "meta",      region: "US_TECH", symbol: "META",  label: "Meta (Facebook)",      unit: "$" },
  { id: "tesla",     region: "US_TECH", symbol: "TSLA",  label: "Tesla",                unit: "$" },
  { id: "broadcom",  region: "US_TECH", symbol: "AVGO",  label: "Broadcom",             unit: "$" },
  { id: "berkshire", region: "US_TECH", symbol: "BRK-B", label: "Berkshire Hathaway",   unit: "$" },
  { id: "jpmorgan",  region: "US_TECH", symbol: "JPM",   label: "JPMorgan Chase",       unit: "$" },
  // US_MOVERS — 변동성 후보 풀 (시총 무관, 변동성 폭 큰 종목)
  // US_MOVERS — Coinbase 제거 (XLU 한도 보호, 2종 유지)
  { id: "amd",       region: "US_TECH", symbol: "AMD",   label: "AMD",                  unit: "$" },
  { id: "palantir",  region: "US_TECH", symbol: "PLTR",  label: "Palantir",             unit: "$" },
  // 미국 ETF (사용자 지정 5종)
  { id: "arq_etf",  region: "US_ETF", symbol: "ARKQ", label: "ARKQ (ARK 자율·로보틱스)",   unit: "$" },
  { id: "gld_etf",  region: "US_ETF", symbol: "GLD",  label: "GLD (SPDR Gold)",           unit: "$" },
  { id: "smrf_etf", region: "US_ETF", symbol: "SMRF", label: "SMRF",                      unit: "$" },
  { id: "xlc_etf",  region: "US_ETF", symbol: "XLC",  label: "XLC (Communication 섹터)",  unit: "$" },
  { id: "xlu_etf",  region: "US_ETF", symbol: "XLU",  label: "XLU (Utilities 섹터)",      unit: "$" },
];

function makeBigtechBuilder(t) {
  return () => buildYahooCard({ id: t.id, region: t.region, label: t.label, unit: t.unit, symbol: t.symbol });
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
  { id: "kr_m2", fn: buildKrM2 },
  { id: "us_m2", fn: buildUsM2 },
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

  const order = [
    "usd_krw", "vix",
    "kospi", "kosdaq", "sp500", "nasdaq",
    "kr_base_rate", "us_fed_funds", "kr_10y", "us_10y",
    "kr_cpi_yoy", "us_cpi_yoy", "kr_unemp", "us_unemp",
    "kr_m2", "us_m2",
    "gold", "silver", "copper", "btc",
    "samsung", "sk_hynix", "lg_energy", "samsung_bio", "hyundai",
    "kia", "naver", "celltrion", "posco", "kakao",
    "hanwha_aero", "ecopro_bm", "alteogen",
    "apple", "microsoft", "nvidia", "google", "amazon",
    "meta", "tesla", "broadcom", "berkshire", "jpmorgan",
    "amd", "palantir",
    "arq_etf", "gld_etf", "smrf_etf", "xlc_etf", "xlu_etf",
  ];
  const items = order.map((id) => byId[id] || { id, error: "missing" });
  await enrichWithStats(items, env);
  return { generatedAt: new Date().toISOString(), items };
}
