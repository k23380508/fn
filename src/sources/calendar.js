// 경제지표 발표 일정 — Forex Factory의 무료 thisweek JSON 사용.
// 한국(KRW)·미국(USD)만 필터링 + 시장 영향 멘트 정적 매핑.
const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

const IMPORTANT_COUNTRIES = new Set(["USD", "KRW"]);

// 시장 영향력 멘트 — title 패턴 매칭 (높은 우선순위가 위에).
// note 앞 이모지로 강도 시각화: 🔴 매우 큼 / 🟠 큼 / 🟡 중간 / 🔵 참고.
const IMPACT_NOTES = [
  { re: /\bADP\b/i,
    note: "🟡 중간 — 민간 고용 (ADP), 금요일 NFP의 선행 신호" }, // ADP먼저 (NFP 패턴에 잡히지 않게)
  { re: /\b(FOMC|Federal Funds Rate|Fed Funds|Fed Chair|Powell|Interest Rate Decision)\b/i,
    note: "🔴 매우 큼 — 글로벌 금리·환율·증시·암호화폐 모두 즉각 반응" },
  { re: /\b(Non[-\s]?Farm Payrolls|NFP|Non[-\s]?Farm Employment Change|Average Hourly Earnings|Employment Situation|Unemployment Rate)\b/i,
    note: "🔴 매우 큼 — 달러·미 국채·증시 변동성 폭 확대 (NFP day)" },
  { re: /\b(CPI|Core CPI|PCE|Core PCE|Inflation Rate)\b/i,
    note: "🔴 매우 큼 — 인플레 경로가 Fed 정책 결정에 직접 반영" },
  { re: /(한국 기준금리|기준금리 결정|금융통화위원회|금통위|BOK (Rate )?Decision|Bank of Korea (Interest )?Rate)/i,
    note: "🔴 매우 큼 — 한국 기준금리 결정, 원화·국내 금리·코스피 즉각 반응" },
  { re: /\b(GDP|Gross Domestic Product)\b/i,
    note: "🔴 매우 큼 — 거시 성장 핵심, 환율·증시 추세 결정" },
  { re: /\b(PPI|Producer Price)\b/i,
    note: "🟠 큼 — CPI 선행 지표, 인플레 방향성 가늠" },
  { re: /\b(Retail Sales|Consumer Sentiment|Consumer Confidence|UoM)\b/i,
    note: "🟠 큼 — 소비 모멘텀·경기 체감 신호" },
  { re: /\b(ISM (Manufacturing|Services|Non[-\s]?Manufacturing)|Manufacturing PMI|Services PMI)\b/i,
    note: "🟠 큼 — 경기 모멘텀, 채권·증시 반응" },
  { re: /\b(Unemployment Claims|Jobless Claims|Initial Claims)\b/i,
    note: "🟡 중간 — 주간 노동시장 단기 신호" },
  { re: /\b(JOLTS|Job Openings)\b/i,
    note: "🟡 중간 — 노동시장 타이트니스, NFP와 함께 해석" },
  { re: /\b(Trade Balance|Exports|Imports|Current Account)\b/i,
    note: "🟡 중간 — 무역·반도체·자동차주 영향" },
  { re: /\b(Housing Starts|Building Permits|New Home Sales|Existing Home Sales|Pending Home)\b/i,
    note: "🟡 중간 — 주택 경기 + 소비·금리 민감" },
  { re: /\b(Industrial Production|Capacity Utilization|Durable Goods)\b/i,
    note: "🟡 중간 — 제조업 모멘텀, 반도체·산업주 영향" },
  { re: /\b(Treasury|Auction|Bond)\b/i,
    note: "🟡 중간 — 채권 수익률·달러 유동성 신호" },
  { re: /Speaks?|Testimony/i,
    note: "🔵 참고 — 발언 내용에 따라 변동 (중앙은행 인사 발언)" },
  { re: /(한국 CPI|Korea CPI|Korean CPI|South Korea CPI)/i,
    note: "🟠 큼 — 한은 정책 방향성 + 코스피 영향" },
  { re: /(한국 GDP|Korea GDP|South Korea GDP)/i,
    note: "🔴 매우 큼 — 코스피·원화 핵심 거시 지표" },
  { re: /(외환보유액|FX Reserves|Foreign Reserves)/i,
    note: "🟡 중간 — 원화 안정성·외환 정책 신호" },
  { re: /(통화·?유동성|통화금융|Money Supply|M2)/i,
    note: "🟡 중간 — 시중 유동성·물가 압력 가늠" },
  { re: /(수출입 잠정|수출 잠정|관세청|Trade Balance.*Korea|Korea Trade)/i,
    note: "🟠 큼 — 반도체·자동차·조선주 주가 직접 반응" },
  { re: /(외국인 채권|외국인 주식|Foreign Holdings)/i,
    note: "🟡 중간 — 외국인 자금 흐름·원화 영향" },
  { re: /(금융통화위원회|금통위|MPC|BOK Monetary Policy)/i,
    note: "🔴 매우 큼 — 한국 기준금리 결정, 원화·증시·채권 즉각 반응" },
];

function getMarketImpact(event) {
  for (const r of IMPACT_NOTES) {
    if (r.re.test(event.title)) return r.note;
  }
  if (event.impact === "High") return "🟠 큼 — 단기 시장 변동 예상";
  if (event.impact === "Medium") return "🟡 중간 — 일부 자산 변동 가능";
  return "🔵 참고";
}

// KRW가 Forex Factory에 거의 등록 안 되어 매주 수동 보강.
// 갱신 주기: 매주 월요일 — 한국은행/통계청/관세청/금감원 일정 기반.
// 갱신 시: CALENDAR_KEY 버전 bump (index.js) 또는 ?fresh=1 호출.
const KR_STATIC_THIS_WEEK = [
  // 5/4 (월) 11:00 — 한국은행 외환보유액 (월초 정기)
  { title: "한국 4월 외환보유액 (한국은행)",
    date: "2026-05-04T11:00:00+09:00", impact: "Medium",
    forecast: "", previous: "$415.5B" },

  // 5/7 (목) 09:00 — 한국은행 외환시장 동향
  { title: "한국 4월 외환시장 동향 (한국은행)",
    date: "2026-05-07T09:00:00+09:00", impact: "Medium",
    forecast: "", previous: "" },

  // 5/8 (금) 12:00 — 한국은행 통화·유동성 동향 (M1·M2)
  { title: "한국 4월 통화·유동성 동향 (한국은행, M2)",
    date: "2026-05-08T12:00:00+09:00", impact: "Medium",
    forecast: "", previous: "" },

  // 5/8 (금) 12:00 — 금감원 외국인 채권 투자
  { title: "한국 4월 외국인 채권 보유 동향 (금감원)",
    date: "2026-05-08T12:00:00+09:00", impact: "Medium",
    forecast: "", previous: "" },

  // 5/11 (월) 09:00 — 관세청 5월 1~10일 수출입 잠정 (다음 주 시작이지만 thisweek 끝에 포함)
  { title: "한국 5월 1-10일 수출입 잠정치 (관세청)",
    date: "2026-05-11T09:30:00+09:00", impact: "High",
    forecast: "", previous: "" },
];

async function fetchEvents() {
  const res = await fetch(FF_URL, {
    cf: { cacheTtl: 3600, cacheEverything: true },
    headers: { "User-Agent": "Mozilla/5.0 (compatible; mp1-worker/1.0)" },
  });
  if (!res.ok) throw new Error(`Calendar HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Calendar bad format");
  return data
    .filter((e) => e && (e.impact === "High" || e.impact === "Medium"))
    .filter((e) => IMPORTANT_COUNTRIES.has(e.country))
    .map((e) => ({
      title: e.title || "",
      country: e.country || "",
      date: e.date || "",
      impact: e.impact || "",
      forecast: e.forecast || "",
      previous: e.previous || "",
      actual: e.actual || "",
    }));
}

export async function buildCalendar() {
  let fetched = [];
  let fetchError = null;
  try {
    fetched = await fetchEvents();
  } catch (err) {
    fetchError = err.message;
  }
  const krStatic = KR_STATIC_THIS_WEEK.map((e) => ({
    country: "KRW",
    forecast: "", previous: "", actual: "",
    ...e,
  }));
  const all = [...fetched, ...krStatic].map((e) => ({
    ...e,
    marketImpact: getMarketImpact(e),
  }));
  return {
    generatedAt: new Date().toISOString(),
    events: all,
    ...(fetchError ? { fetchError } : {}),
  };
}
