function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtValue(v, unit) {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const s = abs >= 1000
    ? v.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
    : v.toFixed(2);
  if (unit === "원") return `${s} ${unit}`;
  if (unit === "$") return `$${s}`;
  if (unit) return `${s}${unit}`;
  return s;
}

function fmtDelta(delta, unit) {
  if (!delta || !Number.isFinite(delta.abs)) return { text: "—", dir: "flat" };
  const sign = delta.abs > 0 ? "▲" : delta.abs < 0 ? "▼" : "·";
  const dir = delta.abs > 0 ? "up" : delta.abs < 0 ? "down" : "flat";
  const absVal = Math.abs(delta.abs);
  const absStr = absVal >= 1000
    ? absVal.toLocaleString("ko-KR", { maximumFractionDigits: 2 })
    : absVal.toFixed(2);
  const pctStr = Number.isFinite(delta.pct) ? ` (${delta.abs >= 0 ? "+" : "−"}${Math.abs(delta.pct).toFixed(2)}%)` : "";
  const showUnit = unit && unit !== "원" && unit !== "$";
  return { text: `${sign} ${absStr}${showUnit ? unit : ""}${pctStr}`, dir };
}

function regionBadge(region) {
  if (region === "KR") return `<span class="badge kr">KR</span>`;
  if (region === "US") return `<span class="badge us">US</span>`;
  if (region === "CMD") return `<span class="badge cmd">금속</span>`;
  if (region === "CRY") return `<span class="badge cry">CRYPTO</span>`;
  return `<span class="badge fx">FX</span>`;
}

const CHARTABLE_IDS = new Set([
  "usd_krw", "kospi", "kosdaq", "sp500", "nasdaq", "vix",
  "kr_base_rate", "us_fed_funds", "kr_10y", "us_10y",
  "kr_cpi_yoy", "us_cpi_yoy", "kr_unemp", "us_unemp",
  "gold", "silver", "copper", "btc",
]);

function card(item, hero = false) {
  if (item.error) {
    return `
    <article class="card${hero ? " hero" : ""} err">
      <div class="card-head"><span class="label">${escape(item.id)}</span></div>
      <div class="value">데이터 없음</div>
      <div class="meta err-msg">${escape(item.error)}</div>
    </article>`;
  }
  const d = fmtDelta(item.delta, item.unit);
  const chartable = CHARTABLE_IDS.has(item.id);
  const dataAttr = chartable ? ` data-series-id="${escape(item.id)}" data-label="${escape(item.label)}" tabindex="0" role="button" aria-label="${escape(item.label)} 차트 열기"` : "";
  return `
    <article class="card${hero ? " hero" : ""}${chartable ? " clickable" : ""}"${dataAttr}>
      <div class="card-head">
        ${regionBadge(item.region)}
        <span class="label">${escape(item.label)}</span>
      </div>
      <div class="value">${escape(fmtValue(item.value, item.unit))}</div>
      <div class="delta ${d.dir}">${escape(d.text)}</div>
      <div class="meta">기준 ${escape(item.date || "")}</div>
    </article>`;
}

function fmtPubDate(s) {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    const now = Date.now();
    const diffMin = Math.round((now - d.getTime()) / 60000);
    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}시간 전`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 7) return `${diffD}일 전`;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  } catch {
    return s;
  }
}

function newsSection(title, flagEmoji, items) {
  if (items?.error) {
    return `<section class="news-col"><h2>${flagEmoji} ${escape(title)}</h2><div class="meta err-msg">뉴스 로드 실패: ${escape(items.error)}</div></section>`;
  }
  if (!Array.isArray(items) || !items.length) {
    return `<section class="news-col"><h2>${flagEmoji} ${escape(title)}</h2><div class="meta">뉴스 없음</div></section>`;
  }
  const list = items.slice(0, 5).map((n) => {
    const transBadge = n.translated ? '<span class="ko-badge" title="한국어 자동 번역">KO</span>' : "";
    return `
    <li class="news-item">
      <a href="${escape(n.link)}" target="_blank" rel="noopener noreferrer" class="news-link">${transBadge}${escape(n.title)}</a>
      <div class="news-meta">${escape(n.source || "")}${n.source && n.pubDate ? " · " : ""}${escape(fmtPubDate(n.pubDate))}</div>
    </li>`;
  }).join("");
  return `<section class="news-col"><h2>${flagEmoji} ${escape(title)}</h2><ul class="news-list">${list}</ul></section>`;
}

function fmtKst(iso) {
  try {
    const d = new Date(iso);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(kst.getUTCDate()).padStart(2, "0");
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mi = String(kst.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi} KST`;
  } catch {
    return iso;
  }
}

export function renderHtml(snapshot, news) {
  const byId = Object.fromEntries(snapshot.items.map((i) => [i.id, i]));
  const heroIds = ["usd_krw", "us_kr_spread"];
  const equityIds = ["kospi", "kosdaq", "sp500", "nasdaq", "vix"];
  const ratesIds = ["kr_base_rate", "us_fed_funds", "kr_10y", "us_10y"];
  const inflationIds = ["kr_cpi_yoy", "us_cpi_yoy"];
  const laborIds = ["kr_unemp", "us_unemp"];
  const assetIds = ["gold", "silver", "copper", "btc"];

  const heroHtml = heroIds.map((id) => card(byId[id] || { id, error: "missing" }, true)).join("");
  const equityHtml = equityIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const ratesHtml = ratesIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const inflHtml = inflationIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const laborHtml = laborIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const assetHtml = assetIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#0b1020" />
<title>KR vs US 거시 대시보드</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --bg: #0b1020;
    --card: #161b2e;
    --text: #e8ecf3;
    --muted: #8a93a6;
    --up: #22c55e;
    --down: #ef4444;
    --kr: #3b82f6;
    --us: #f59e0b;
    --fx: #a78bfa;
    --cmd: #eab308;
    --cry: #f97316;
    --border: #232a44;
  }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Pretendard", "Apple SD Gothic Neo", sans-serif;
    -webkit-font-smoothing: antialiased;
    line-height: 1.4;
    min-height: 100vh;
  }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 20px 16px 64px; }
  header { padding: 8px 0 24px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
  h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: -0.01em; }
  .updated { color: var(--muted); font-size: 13px; }
  h2 { font-size: 14px; color: var(--muted); margin: 28px 0 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .grid.hero { gap: 12px; }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 14px 16px 16px;
  }
  .card.hero { padding: 18px 18px 20px; }
  .card.err { opacity: 0.7; }
  .card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .label { color: var(--muted); font-size: 13px; }
  .badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; letter-spacing: 0.04em; }
  .badge.kr { background: rgba(59,130,246,0.15); color: var(--kr); }
  .badge.us { background: rgba(245,158,11,0.15); color: var(--us); }
  .badge.fx { background: rgba(167,139,250,0.15); color: var(--fx); }
  .badge.cmd { background: rgba(234,179,8,0.15); color: var(--cmd); }
  .badge.cry { background: rgba(249,115,22,0.15); color: var(--cry); }
  .value { font-size: 24px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
  .card.hero .value { font-size: 30px; }
  .delta { font-size: 13px; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .delta.up { color: var(--up); }
  .delta.down { color: var(--down); }
  .delta.flat { color: var(--muted); }
  .meta { color: var(--muted); font-size: 12px; margin-top: 6px; }
  .err-msg { color: var(--down); }
  footer { color: var(--muted); font-size: 12px; margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); line-height: 1.6; }
  footer a { color: var(--muted); text-decoration: underline; }
  .card.clickable { cursor: pointer; transition: transform 0.1s ease, border-color 0.1s; }
  .card.clickable:hover, .card.clickable:focus { transform: translateY(-1px); border-color: var(--kr); outline: none; }
  .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 12px; backdrop-filter: blur(4px); }
  .modal.hidden { display: none; }
  .modal-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; max-width: 820px; width: 100%; padding: 18px; max-height: 90vh; overflow: auto; }
  .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .modal-head h3 { margin: 0; font-size: 16px; letter-spacing: -0.01em; }
  .modal-close { background: transparent; border: none; color: var(--muted); font-size: 26px; cursor: pointer; padding: 0 6px; line-height: 1; }
  .modal-close:hover { color: var(--text); }
  .range-tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
  .range-tabs button { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; }
  .range-tabs button:hover { color: var(--text); }
  .range-tabs button.active { background: var(--kr); color: white; border-color: var(--kr); }
  .chart-svg { width: 100%; height: auto; display: block; }
  .chart-loading { color: var(--muted); padding: 60px 20px; text-align: center; font-size: 13px; }
  .chart-meta { color: var(--muted); font-size: 12px; margin-top: 10px; }
  .news-grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 12px; }
  .news-col h2 { margin-top: 0; }
  .news-list { list-style: none; padding: 0; margin: 0; }
  .news-item { padding: 11px 0; border-bottom: 1px solid var(--border); }
  .news-item:last-child { border-bottom: none; padding-bottom: 0; }
  .news-link { color: var(--text); text-decoration: none; font-size: 14px; line-height: 1.45; display: block; }
  .news-link:hover { color: var(--kr); text-decoration: underline; }
  .news-meta { color: var(--muted); font-size: 11px; margin-top: 5px; }
  .ko-badge { display: inline-block; font-size: 9px; font-weight: 700; color: var(--kr); background: rgba(59,130,246,0.15); padding: 1px 5px; border-radius: 4px; margin-right: 6px; vertical-align: middle; letter-spacing: 0.04em; }
  @media (min-width: 768px) {
    .news-grid { grid-template-columns: repeat(3, 1fr); gap: 24px; }
  }
  @media (min-width: 640px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .grid.hero { grid-template-columns: repeat(2, 1fr); }
    .grid.five { grid-template-columns: repeat(5, 1fr); }
    .grid.four { grid-template-columns: repeat(4, 1fr); }
    .grid:not(.hero):not(.four):not(.five) { grid-template-columns: repeat(2, 1fr); }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🌏 KR vs US 거시 대시보드</h1>
    <div class="updated">마지막 업데이트: ${escape(fmtKst(snapshot.generatedAt))}</div>
  </header>

  <h2>핵심 지표</h2>
  <div class="grid hero">${heroHtml}</div>

  <h2>주식 지수 & 변동성</h2>
  <div class="grid five">${equityHtml}</div>

  <h2>금리</h2>
  <div class="grid four">${ratesHtml}</div>

  <h2>물가</h2>
  <div class="grid">${inflHtml}</div>

  <h2>고용</h2>
  <div class="grid">${laborHtml}</div>

  <h2>원자재 & 가상자산</h2>
  <div class="grid four">${assetHtml}</div>

  <h2>핫 뉴스</h2>
  <div class="news-grid">
    ${newsSection("한국 톱 뉴스", "🇰🇷", news?.kr)}
    ${newsSection("미국 톱 뉴스", "🇺🇸", news?.us)}
    ${newsSection("AI 뉴스", "🤖", news?.ai)}
  </div>

  <footer>
    <div>데이터 출처: 한국은행 ECOS · FRED (St. Louis Fed) · Yahoo Finance · CoinGecko · Google News · 번역: Cloudflare Workers AI (m2m100)</div>
    <div>본 페이지는 정보 제공 목적이며, 투자 권유나 자문이 아닙니다. 데이터는 출처에서 지연되어 제공될 수 있습니다.</div>
  </footer>
</div>

<div id="chart-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="chart-title">
  <div class="modal-card">
    <header class="modal-head">
      <h3 id="chart-title"></h3>
      <button class="modal-close" id="chart-close" aria-label="닫기">×</button>
    </header>
    <div class="range-tabs" id="range-tabs">
      <button data-range="1M" class="active">1M</button>
      <button data-range="3M">3M</button>
      <button data-range="6M">6M</button>
      <button data-range="1Y">1Y</button>
      <button data-range="5Y">5Y</button>
    </div>
    <div id="chart-host"><div class="chart-loading">불러오는 중…</div></div>
    <div id="chart-meta" class="chart-meta"></div>
  </div>
</div>

<script>
(function () {
  var modal = document.getElementById("chart-modal");
  var titleEl = document.getElementById("chart-title");
  var hostEl = document.getElementById("chart-host");
  var metaEl = document.getElementById("chart-meta");
  var tabs = document.getElementById("range-tabs");
  var current = { id: null, label: null, range: "1M" };

  function open(id, label) {
    current.id = id; current.label = label; current.range = "1M";
    setActiveTab("1M");
    titleEl.textContent = label;
    modal.classList.remove("hidden");
    load();
  }
  function close() { modal.classList.add("hidden"); }
  function setActiveTab(r) {
    tabs.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.range === r);
    });
  }
  async function load() {
    hostEl.innerHTML = '<div class="chart-loading">불러오는 중…</div>';
    metaEl.textContent = "";
    try {
      var res = await fetch("/api/series?id=" + encodeURIComponent(current.id) + "&range=" + current.range);
      var data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "HTTP " + res.status);
      var s = data.series || [];
      if (!s.length) { hostEl.innerHTML = '<div class="chart-loading">데이터 없음</div>'; return; }
      hostEl.innerHTML = drawSvg(s);
      var first = s[0].date, last = s[s.length - 1].date;
      metaEl.textContent = s.length + " 포인트 · " + first + " ~ " + last;
    } catch (e) {
      hostEl.innerHTML = '<div class="chart-loading">오류: ' + (e.message || e) + '</div>';
    }
  }
  function drawSvg(series) {
    var W = 760, H = 320, P = { top: 14, right: 14, bottom: 30, left: 56 };
    var ys = series.map(function (p) { return p.value; });
    var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    var pad = (yMax - yMin) * 0.06 || Math.abs(yMax) * 0.02 || 1;
    var y0 = yMin - pad, y1 = yMax + pad;
    var n = series.length;
    var sx = function (i) { return P.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - P.left - P.right)); };
    var sy = function (v) { return H - P.bottom - ((v - y0) / (y1 - y0 || 1)) * (H - P.top - P.bottom); };
    var path = "";
    for (var i = 0; i < n; i++) {
      path += (i === 0 ? "M" : "L") + sx(i).toFixed(1) + " " + sy(series[i].value).toFixed(1) + " ";
    }
    var areaPath = path + "L" + sx(n - 1).toFixed(1) + " " + (H - P.bottom) + " L" + sx(0).toFixed(1) + " " + (H - P.bottom) + " Z";
    var ticks = 4;
    var grid = "";
    for (var t = 0; t <= ticks; t++) {
      var v = y0 + (t / ticks) * (y1 - y0);
      var y = sy(v);
      grid += '<line x1="' + P.left + '" y1="' + y.toFixed(1) + '" x2="' + (W - P.right) + '" y2="' + y.toFixed(1) + '" stroke="#232a44" stroke-width="0.5"/>';
      grid += '<text x="' + (P.left - 8) + '" y="' + (y + 4).toFixed(1) + '" fill="#8a93a6" font-size="11" text-anchor="end">' + (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)) + '</text>';
    }
    var first = series[0].date, last = series[n - 1].date;
    var firstVal = series[0].value, lastVal = series[n - 1].value;
    var trendUp = lastVal >= firstVal;
    var stroke = trendUp ? "#22c55e" : "#ef4444";
    var fill = trendUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" class="chart-svg">' +
      grid +
      '<path d="' + areaPath + '" fill="' + fill + '" stroke="none"/>' +
      '<path d="' + path + '" fill="none" stroke="' + stroke + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<text x="' + P.left + '" y="' + (H - 10) + '" fill="#8a93a6" font-size="11">' + first + '</text>' +
      '<text x="' + (W - P.right) + '" y="' + (H - 10) + '" fill="#8a93a6" font-size="11" text-anchor="end">' + last + '</text>' +
      '</svg>';
  }

  document.addEventListener("click", function (e) {
    var card = e.target.closest("[data-series-id]");
    if (card) { open(card.dataset.seriesId, card.dataset.label); return; }
    if (e.target === modal) close();
  });
  document.getElementById("chart-close").addEventListener("click", close);
  tabs.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-range]");
    if (!b) return;
    setActiveTab(b.dataset.range);
    current.range = b.dataset.range;
    load();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
    if (e.key === "Enter" || e.key === " ") {
      var card = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-series-id]");
      if (card) { e.preventDefault(); open(card.dataset.seriesId, card.dataset.label); }
    }
  });
})();
</script>
</body>
</html>`;
}
