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
  naver:        { q: "네이버 NAVER 주가", ko: true },
  kakao:        { q: "카카오 Kakao 주가", ko: true },
  lg_energy:    { q: "LG에너지솔루션 주가", ko: true },
  apple:        { q: "Apple AAPL stock" },
  microsoft:    { q: "Microsoft MSFT stock" },
  nvidia:       { q: "NVIDIA NVDA stock" },
  google:       { q: "Alphabet GOOGL stock" },
  amazon:       { q: "Amazon AMZN stock" },
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
  naver:        "광고·커머스 둔화 우려와 AI 사업 가시화 지연으로 박스권 흐름. 두나무 합병 뉴스가 단기 모멘텀.",
  kakao:        "광고 매출 회복 더디고 AI 차별화 부족으로 약세. 자회사 분리상장 이슈도 부담.",
  lg_energy:    "전기차 캐즘에서의 회복 기대와 ESS·북미 IRA 수혜로 박스권 상단 시도. 중국 BYD 경쟁 부담은 상존.",

  // 미국 빅테크 (Magnificent 5)
  apple:        "iPhone 신모델 판매 호조와 서비스 부문 마진 확대로 신고가 권역. AI 통합(Apple Intelligence) 모멘텀.",
  microsoft:    "Azure AI 매출 성장 둔화 우려와 Capex 부담으로 단기 조정. 다만 엔터프라이즈 AI는 여전히 견조.",
  nvidia:       "$200 저항선에서 차익실현 매물 출회. 다만 AI 수요와 Blackwell 출하 정상화로 중장기 강세 시각 유지.",
  google:       "검색 광고 견조 + Gemini AI 수익화 가시화 + 자율주행(Waymo) 가치 재평가로 +9% 급등.",
  amazon:       "AWS 가속 + 광고 매출 두 자릿수 성장 + 1분기 실적 호조로 신고가 시도. 공급망 서비스 신사업 발표.",

  // 중국 빅테크
  tencent:      "위챗·게임 성장 둔화와 중국 규제 리스크 재부각으로 약세. 1Y -X% 하락 추세 지속.",
  alibaba:      "Morgan Stanley가 'AI race biggest winner' 부각하며 모멘텀 회복 시도. 클라우드·AI 매출 성장률이 핵심.",
  baidu:        "검색 점유율 압박과 자율주행 상업화 지연으로 박스권. AI 검색 차별화가 분기점.",
  xiaomi:       "SU7 EV 판매 호조와 가전 IoT 매출 성장으로 강세. 다만 중국 EV 가격경쟁 격화 부담.",
  byd:          "8개월 연속 EV 판매 감소로 -4.7% 급락. 가격경쟁과 마진 압박이 단기 약세 요인.",
};

async function fetchOne(input, env) {
  const id = typeof input === "string" ? input : input.id;
  const def = QUERIES[id];
  if (!def) return null;
  try {
    const res = await fetch(reasonUrl(def.q, def.ko), {
      cf: { cacheTtl: 600, cacheEverything: true },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; mp1-worker/1.0)" },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const heads = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null && heads.length < 1) {
      const block = m[1];
      heads.push({
        title: unwrapCdata(extract(block, "title")),
        link: unwrapCdata(extract(block, "link")),
        source: unwrapCdata(extract(block, "source")),
      });
    }
    if (!heads.length) return null;
    const top = heads[0];
    const analysis = STATIC_ANALYSIS[id] || null;
    return {
      headline: analysis || top.title,
      link: top.link,
      source: top.source,
      analysis: !!analysis,
      translated: false,
    };
  } catch {
    return null;
  }
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
