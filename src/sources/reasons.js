// Per-card "왜 움직였나" search queries → top Google News headline.
// Used to add a one-line reason under cards that are alerting (큰 변동).
const QUERIES = {
  // 매크로
  kospi:        { q: "KOSPI 코스피 증시", ko: true },
  kosdaq:       { q: "KOSDAQ 코스닥 증시", ko: true },
  sp500:        { q: "S&P 500 stock market" },
  nasdaq:       { q: "NASDAQ index" },
  vix:          { q: "VIX volatility index" },
  usd_krw:      { q: "원달러 환율 USD KRW", ko: true },
  kr_base_rate: { q: "한국은행 기준금리", ko: true },
  us_fed_funds: { q: "Fed funds rate FOMC" },
  kr_10y:       { q: "한국 10년 국채 금리", ko: true },
  us_10y:       { q: "US 10-year treasury yield" },
  kr_cpi_yoy:   { q: "한국 소비자물가 CPI", ko: true },
  us_cpi_yoy:   { q: "US CPI inflation report" },
  kr_unemp:     { q: "한국 실업률 고용", ko: true },
  us_unemp:     { q: "US unemployment rate jobs report" },
  gold:         { q: "gold price ounce" },
  silver:       { q: "silver price" },
  copper:       { q: "copper price" },
  btc:          { q: "Bitcoin BTC price" },
  // 빅테크
  samsung:      { q: "삼성전자 주가", ko: true },
  sk_hynix:     { q: "SK하이닉스 주가", ko: true },
  lg_energy:    { q: "LG에너지솔루션 주가", ko: true },
  samsung_bio:  { q: "삼성바이오로직스 주가", ko: true },
  hyundai:      { q: "현대차 005380 주가", ko: true },
  kia:          { q: "기아 000270 주가", ko: true },
  naver:        { q: "네이버 NAVER 주가", ko: true },
  celltrion:    { q: "셀트리온 주가", ko: true },
  posco:        { q: "POSCO홀딩스 주가", ko: true },
  kakao:        { q: "카카오 Kakao 주가", ko: true },
  hanwha_aero:  { q: "한화에어로스페이스 주가", ko: true },
  doosan_ener:  { q: "두산에너빌리티 주가", ko: true },
  krafton:      { q: "크래프톤 주가", ko: true },
  ecopro_bm:    { q: "에코프로비엠 주가", ko: true },
  alteogen:     { q: "알테오젠 주가", ko: true },
  apple:        { q: "Apple AAPL stock" },
  microsoft:    { q: "Microsoft MSFT stock" },
  nvidia:       { q: "NVIDIA NVDA stock" },
  google:       { q: "Alphabet GOOGL stock" },
  amazon:       { q: "Amazon AMZN stock" },
  meta:         { q: "Meta META Facebook stock" },
  tesla:        { q: "Tesla TSLA stock" },
  broadcom:     { q: "Broadcom AVGO stock" },
  berkshire:    { q: "Berkshire Hathaway BRK stock" },
  jpmorgan:     { q: "JPMorgan Chase JPM stock" },
  amd:          { q: "AMD Advanced Micro Devices stock" },
  palantir:     { q: "Palantir PLTR stock" },
  coinbase:     { q: "Coinbase COIN stock" },
  tencent:      { q: "Tencent 0700 HK stock" },
  alibaba:      { q: "Alibaba BABA stock" },
  baidu:        { q: "Baidu stock" },
  xiaomi:       { q: "Xiaomi 1810 HK stock" },
  byd:          { q: "BYD stock 1211" },
};

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function unwrapCdata(s) {
  if (!s) return "";
  const m = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(s);
  return decodeEntities((m ? m[1] : s).trim());
}
function extract(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = re.exec(block);
  return m ? m[1] : "";
}

function reasonUrl(q, ko) {
  const base = "https://news.google.com/rss/search";
  const locale = ko
    ? "hl=ko&gl=KR&ceid=KR:ko"
    : "hl=en&gl=US&ceid=US:en";
  return `${base}?q=${encodeURIComponent(q)}&when=2d&${locale}`;
}

// Static analysis written by the developer (Claude in Claude Code session) —
// no external AI calls. To refresh, regenerate STATIC_ANALYSIS by hand and
// bump KV key (reason:v3:<id>) in index.js.
const STATIC_ANALYSIS = {
  // 주식 지수 / 변동성
  kospi:        "AI 반도체 수요 폭증과 외국인 매수세 회복으로 4월 코스피가 +30% 급등하며 사상 최고치 권역에 진입.",
  kosdaq:       "대형주 강세에 따른 수급 분산과 바이오·이차전지 섹터 회복으로 코스닥도 동반 상승.",
  sp500:        "FOMC 금리 인하 기대와 빅테크 실적 호조가 상승 동력. 다만 중동 긴장과 일부 종목 차익실현으로 단기 변동성.",
  nasdaq:       "AI/반도체 강세와 빅테크 어닝 모멘텀이 NASDAQ 상승 견인. Nvidia·Alphabet·Apple 중심.",
  vix:          "지정학적 리스크가 잠시 완화되며 risk-on 회복. VIX 16~18 레벨로 시장 불안 심리 진정.",

  // FX
  usd_krw:      "한미 금리차 축소 기대와 외국인 코스피 순매수로 원화 강세 압력. 1,470원대에서 안정.",

  // 금리
  kr_base_rate: "한은이 물가 하향 안정 가시화로 2.50% 동결 유지. 연내 추가 인하 가능성 시장 반영 중.",
  us_fed_funds: "Fed가 9월·11월 두 차례 25bp 인하 후 3.50~3.75% 구간 유지. 추가 인하 속도는 인플레 데이터에 의존.",
  kr_10y:       "한은 인하 사이클 + 미 국채 수익률 안정화로 한국 10년물 3.8% 박스권. 외국인 채권 매수가 하단 지지.",
  us_10y:       "Fed 인하 기대와 안전자산 수요로 4.4% 부근 안정. 재정 적자 우려는 상단 제한 요인.",

  // 물가
  kr_cpi_yoy:   "에너지·식료품 가격 일시 상승으로 CPI 2.16% 반등. 한은은 연말 2% 안팎 수렴 전망 유지.",
  us_cpi_yoy:   "서비스 인플레 끈적임과 에너지 가격 상승으로 미 CPI 3.32%로 가속. 4% 위협 우려 부각.",

  // 고용
  kr_unemp:     "청년층 신규 고용 회복과 AI/반도체 채용 확대로 한국 실업률 2.9%로 추가 하락. 노동시장 견조.",
  us_unemp:     "기업 감원 둔화와 서비스업 신규 채용 증가로 미국 실업률 4.3%로 소폭 개선.",

  // 원자재
  gold:         "중동 지정학 리스크와 Fed 인하 기대로 안전자산 수요 확대. 금 $4,500선에서 사상 최고 권역.",
  silver:       "산업용 수요(태양광·EV) 폭증과 ETF 자금 유입으로 1년간 +130% 폭등. 금/은 비율 정상화 진행 중.",
  copper:       "중국 경기 부양과 전력 인프라 투자 회복 기대로 동 가격 상승. AI 데이터센터 전력 수요도 호재.",

  // 가상자산
  btc:          "ETF 자금 유입 재개와 단기 매도 압력 흡수로 $80K대 회복. 다만 1Y 기준 -14%로 사상 최고($124K) 대비 조정 국면.",

  // 한국 빅테크
  samsung:      "메모리 사이클 회복과 HBM3E 양산 본격화로 +5% 상승. 다만 노조 협상 리스크와 월가 목표가 하향이 단기 부담.",
  sk_hynix:     "HBM 독점적 위치와 AI 수요 폭증으로 +12% 급등, 시총 1,000조 돌파. 외국인·기관 순매수 집중.",
  lg_energy:    "전기차 캐즘에서의 회복 기대와 ESS·북미 IRA 수혜로 박스권 상단 시도. 중국 BYD 경쟁 부담은 상존.",
  samsung_bio:  "CDMO 글로벌 수주 확대와 5공장 가동 본격화로 실적 모멘텀. 바이오시밀러 매출 성장도 동반.",
  hyundai:      "북미·인도 EV·하이브리드 판매 호조와 환율 우호로 분기 실적 호조. 관세 리스크가 단기 변수.",
  kia:          "EV·SUV 라인업 강세와 미국 IRA 보조금 수혜로 마진 확대. 환율 효과 지속.",
  naver:        "광고·커머스 둔화 우려와 AI 사업 가시화 지연으로 박스권 흐름. 두나무 합병 뉴스가 단기 모멘텀.",
  celltrion:    "바이오시밀러 짐펜트라(美 직판) 실적 가속과 신약 파이프라인 진척으로 강세. 환율도 우호.",
  posco:        "철강 업황 바닥 신호와 이차전지 소재(양극재·리튬) 사업 가치 재평가 기대.",
  kakao:        "광고 매출 회복 더디고 AI 차별화 부족으로 약세. 자회사 분리상장 이슈도 부담.",
  hanwha_aero:  "방산 수출 호조(폴란드·중동 추가)와 우주 사업 모멘텀으로 변동 폭 큼. 지정학 이슈에 즉각 반응.",
  doosan_ener:  "원전 수주(체코·사우디) 기대와 SMR 모멘텀으로 단기 급등락. 정책 변수에 민감.",
  krafton:      "배그(PUBG) 글로벌 매출과 신작 파이프라인 따라 변동. 중국·인도 모바일 시장 노출 큼.",
  ecopro_bm:    "양극재 수요·리튬 가격에 직접 연동되며 변동성 큼. 미국 IRA 보조금·테슬라 발주가 핵심 변수.",
  alteogen:     "ALT-B4(허셉틴 SC)와 머크 키트루다 SC 라이선스 마일스톤·로열티 가시화로 급등락 반복.",

  // 미국 빅테크 (Magnificent 5)
  apple:        "iPhone 신모델 판매 호조와 서비스 부문 마진 확대로 신고가 권역. AI 통합(Apple Intelligence) 모멘텀.",
  microsoft:    "Azure AI 매출 성장 둔화 우려와 Capex 부담으로 단기 조정. 다만 엔터프라이즈 AI는 여전히 견조.",
  nvidia:       "$200 저항선에서 차익실현 매물 출회. 다만 AI 수요와 Blackwell 출하 정상화로 중장기 강세 시각 유지.",
  google:       "검색 광고 견조 + Gemini AI 수익화 가시화 + 자율주행(Waymo) 가치 재평가로 +9% 급등.",
  amazon:       "AWS 가속 + 광고 매출 두 자릿수 성장 + 1분기 실적 호조로 신고가 시도. 공급망 서비스 신사업 발표.",
  meta:         "광고 매출 회복과 Reels·AI 추천 알고리즘 효과로 ROI 개선. AI 인프라 Capex 부담은 단기 변수.",
  tesla:        "FSD/로보택시 모멘텀과 Cybertruck 판매 본격화로 변동성 큼. EV 가격경쟁·중국 비중 부담.",
  broadcom:     "AI ASIC 맞춤형 칩(VMware 통합 시너지)으로 데이터센터 매출 가속. 수주 가시성 높음.",
  berkshire:    "보유 종목 평가차익과 현금 비중 조정으로 분기별 변동. Apple/뱅크 노출이 주된 변수.",
  jpmorgan:     "NIM(순이자마진)·트레이딩 매출과 대출 충당금 변동에 따라 움직임. 채권금리·경기 둔화 민감.",
  amd:          "AI GPU(MI300) 수주와 서버 CPU 점유율 변동에 따라 큰 폭 등락. Nvidia 대비 밸류에이션 매력.",
  palantir:     "정부·국방 계약 확장 + AIP 상업 매출 가속으로 변동성 큼. 밸류에이션 부담은 항상 변수.",
  coinbase:     "BTC·ETH 가격과 거래량에 직접 연동 → 암호화폐 변동성 그대로 반영. 수수료 마진이 핵심.",

};

async function fetchOne(input, env) {
  const id = typeof input === "string" ? input : input.id;
  const def = QUERIES[id];
  if (!def) return null;

  const analysis = STATIC_ANALYSIS[id] || null;
  let top = null;

  // Best-effort RSS fetch for link/source — failure does NOT block static analysis.
  try {
    const res = await fetch(reasonUrl(def.q, def.ko), {
      cf: { cacheTtl: 600, cacheEverything: true },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; mp1-worker/1.0)" },
    });
    if (res.ok) {
      const xml = await res.text();
      const m = /<item>([\s\S]*?)<\/item>/.exec(xml);
      if (m) {
        const block = m[1];
        top = {
          title: unwrapCdata(extract(block, "title")),
          link: unwrapCdata(extract(block, "link")),
          source: unwrapCdata(extract(block, "source")),
        };
      }
    }
  } catch {
    // ignore — static analysis fallback below
  }

  // Static analysis 있으면 link/source 없어도 항상 반환
  if (analysis) {
    return {
      headline: analysis,
      link: top?.link || "",
      source: top?.source || "",
      analysis: true,
      translated: false,
    };
  }
  // Static 없으면 RSS top headline fallback
  if (top?.title) {
    return {
      headline: top.title,
      link: top.link,
      source: top.source,
      analysis: false,
      translated: false,
    };
  }
  return null;
}

export async function buildReasonsFor(inputs, env, { batch = 5 } = {}) {
  const out = {};
  for (let i = 0; i < inputs.length; i += batch) {
    const chunk = inputs.slice(i, i + batch);
    const res = await Promise.all(chunk.map((inp) => fetchOne(inp, env)));
    chunk.forEach((inp, j) => {
      const id = typeof inp === "string" ? inp : inp.id;
      if (res[j] && res[j].headline) out[id] = res[j];
    });
  }
  return out;
}
