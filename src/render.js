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
  if (unit === "HK$") return `HK$${s}`;
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
  if (region === "KR_TECH") return `<span class="badge kr-tech">K-TECH</span>`;
  if (region === "US_TECH") return `<span class="badge us-tech">US-TECH</span>`;
  if (region === "CN") return `<span class="badge cn">CN</span>`;
  if (region === "CMD") return `<span class="badge cmd">금속</span>`;
  if (region === "CRY") return `<span class="badge cry">CRYPTO</span>`;
  return `<span class="badge fx">FX</span>`;
}

const CHARTABLE_IDS = new Set([
  "usd_krw", "kospi", "kosdaq", "sp500", "nasdaq", "vix",
  "kr_base_rate", "us_fed_funds", "kr_10y", "us_10y",
  "kr_cpi_yoy", "us_cpi_yoy", "kr_unemp", "us_unemp",
  "gold", "silver", "copper", "btc",
  "samsung", "sk_hynix", "naver", "kakao", "lg_energy",
  "apple", "microsoft", "nvidia", "google", "amazon",
  "tencent", "alibaba", "baidu", "xiaomi", "byd",
]);

const ALERT_PCT = 3;

function alertClass(item) {
  const pct = item?.delta?.pct;
  if (!Number.isFinite(pct)) return "";
  if (pct >= ALERT_PCT) return " alert-up";
  if (pct <= -ALERT_PCT) return " alert-down";
  return "";
}

function rangeBar(label, st, current, unit, pos, badge) {
  const lowStr = escape(fmtValue(st.lo, unit));
  const hiStr = escape(fmtValue(st.hi, unit));
  const cls = badge?.cls || "";
  const tag = badge?.tag || "";
  return `
    <div class="rng${cls}">
      <div class="rng-head">
        <span class="rng-label">${label}</span>
        ${tag}
      </div>
      <div class="rng-body">
        <span class="rng-low" title="${escape(st.loDate || '')} 저점">${lowStr}</span>
        <span class="rng-track">
          <span class="rng-marker" style="left:${pos.toFixed(1)}%"></span>
        </span>
        <span class="rng-high" title="${escape(st.hiDate || '')} 고점">${hiStr}</span>
      </div>
    </div>`;
}

function statsBlock(item) {
  if (!item?.stats || !Number.isFinite(item.value)) return "";
  const order = ["1M", "3M", "6M", "1Y"];
  const rows = order
    .filter((k) => item.stats[k] && Number.isFinite(item.stats[k].hi) && Number.isFinite(item.stats[k].lo) && item.stats[k].hi !== item.stats[k].lo)
    .map((k) => {
      const s = item.stats[k];
      const pos = Math.max(0, Math.min(100, ((item.value - s.lo) / (s.hi - s.lo)) * 100));
      return { key: k, stats: s, pos };
    });
  if (!rows.length) return "";
  // Identify extremes for badge tagging
  const maxPos = Math.max(...rows.map((r) => r.pos));
  const minPos = Math.min(...rows.map((r) => r.pos));
  const NEAR_HIGH = 92;
  const NEAR_LOW = 8;
  function badgeFor(r) {
    if (r.pos >= NEAR_HIGH) return { cls: " near-high", tag: ' <span class="rng-tag high">🔥 신고가권</span>' };
    if (r.pos <= NEAR_LOW) return { cls: " near-low", tag: ' <span class="rng-tag low">🔥 신저가권</span>' };
    if (rows.length > 1 && r.pos === maxPos && r.pos > 70) return { cls: " soft-high", tag: ' <span class="rng-tag high soft">최고권</span>' };
    if (rows.length > 1 && r.pos === minPos && r.pos < 30) return { cls: " soft-low", tag: ' <span class="rng-tag low soft">최저권</span>' };
    return null;
  }
  const html = rows.map((r) => rangeBar(r.key, r.stats, item.value, item.unit, r.pos, badgeFor(r))).join("");
  return `<div class="stats">${html}</div>`;
}

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
    <article class="card${hero ? " hero" : ""}${chartable ? " clickable" : ""}${alertClass(item)}"${dataAttr}>
      <div class="card-head">
        ${regionBadge(item.region)}
        <span class="label">${escape(item.label)}</span>
      </div>
      <div class="value">${escape(fmtValue(item.value, item.unit))}</div>
      <div class="delta ${d.dir}">${escape(d.text)}</div>
      <div class="meta">기준 ${escape(item.date || "")}</div>
      ${reasonBlock(item)}
      ${statsBlock(item)}
    </article>`;
}

function reasonBlock(item) {
  // Empty placeholder — populated client-side via /api/reasons (lazy load)
  // for cards that are alerting (큰 변동) to avoid Worker subrequest limit.
  if (item?.error) return "";
  const ALERT_PCT = 3;
  const pct = item?.delta?.pct;
  if (!Number.isFinite(pct) || Math.abs(pct) < ALERT_PCT) return "";
  return `<div class="reason-slot" data-reason-for="${escape(item.id)}"></div>`;
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
  const krTechIds = ["samsung", "sk_hynix", "naver", "kakao", "lg_energy"];
  const usTechIds = ["apple", "microsoft", "nvidia", "google", "amazon"];
  const cnTechIds = ["tencent", "alibaba", "baidu", "xiaomi", "byd"];

  const heroHtml = heroIds.map((id) => card(byId[id] || { id, error: "missing" }, true)).join("");
  const equityHtml = equityIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const ratesHtml = ratesIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const inflHtml = inflationIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const laborHtml = laborIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const assetHtml = assetIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const krTechHtml = krTechIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const usTechHtml = usTechIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");
  const cnTechHtml = cnTechIds.map((id) => card(byId[id] || { id, error: "missing" })).join("");

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
  .badge.kr-tech { background: rgba(59,130,246,0.18); color: var(--kr); }
  .badge.us-tech { background: rgba(245,158,11,0.18); color: var(--us); }
  .badge.cn { background: rgba(239,68,68,0.18); color: var(--down); }
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
  @keyframes pulse-up {
    0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.0); border-color: rgba(34,197,94,0.55); }
    50%      { box-shadow: 0 0 16px 3px rgba(34,197,94,0.55); border-color: rgba(34,197,94,1); }
  }
  @keyframes pulse-down {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.0); border-color: rgba(239,68,68,0.55); }
    50%      { box-shadow: 0 0 16px 3px rgba(239,68,68,0.55); border-color: rgba(239,68,68,1); }
  }
  .card.alert-up   { animation: pulse-up 1.6s ease-in-out infinite; border-width: 1px; }
  .card.alert-down { animation: pulse-down 1.6s ease-in-out infinite; border-width: 1px; }
  .card.alert-up::before, .card.alert-down::before {
    content: "주의"; position: absolute; top: 8px; right: 10px;
    font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
    letter-spacing: 0.05em;
  }
  .card.alert-up::before { background: rgba(34,197,94,0.18); color: var(--up); }
  .card.alert-down::before { background: rgba(239,68,68,0.18); color: var(--down); }
  .card { position: relative; }
  .reason-link { display: flex; align-items: flex-start; gap: 6px; margin-top: 10px; padding: 7px 9px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 6px; text-decoration: none; color: var(--muted); font-size: 11px; line-height: 1.4; transition: background 0.15s, border-color 0.15s; }
  .reason-link:hover { background: rgba(59,130,246,0.10); border-color: var(--kr); color: var(--text); }
  .reason-ic { flex-shrink: 0; opacity: 0.85; }
  .reason-text { flex: 1; min-width: 0; }
  .reason-source { color: var(--muted); font-size: 10px; flex-shrink: 0; opacity: 0.75; white-space: nowrap; max-width: 80px; overflow: hidden; text-overflow: ellipsis; }
  .stats { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); display: flex; flex-direction: column; gap: 6px; }
  .rng { display: flex; flex-direction: column; gap: 2px; padding: 4px 6px; border-radius: 5px; }
  .rng-head { display: flex; align-items: center; gap: 6px; min-height: 13px; }
  .rng-label { color: var(--muted); font-weight: 700; letter-spacing: 0.04em; font-size: 9px; }
  .rng-body { display: grid; grid-template-columns: minmax(40px, max-content) 1fr minmax(40px, max-content); align-items: center; gap: 8px; font-size: 10px; font-variant-numeric: tabular-nums; color: var(--muted); }
  .rng-low { color: var(--down); white-space: nowrap; }
  .rng-high { color: var(--up); text-align: right; white-space: nowrap; }
  .rng-track { position: relative; height: 3px; background: var(--border); border-radius: 2px; min-width: 0; }
  .rng-marker { position: absolute; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--text); transform: translateX(-50%); border: 1.5px solid var(--card); box-shadow: 0 0 0 1px var(--text); }
  .rng-tag { font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.02em; white-space: nowrap; line-height: 1.3; }
  .rng-tag.high { background: rgba(34,197,94,0.25); color: var(--up); }
  .rng-tag.low { background: rgba(239,68,68,0.25); color: var(--down); }
  .rng-tag.soft { opacity: 0.6; font-weight: 700; }
  @keyframes rng-pulse-high {
    0%, 100% { background: rgba(34,197,94,0.04); box-shadow: inset 0 0 0 1px rgba(34,197,94,0.20); }
    50%      { background: rgba(34,197,94,0.18); box-shadow: inset 0 0 0 1px rgba(34,197,94,0.70); }
  }
  @keyframes rng-pulse-low {
    0%, 100% { background: rgba(239,68,68,0.04); box-shadow: inset 0 0 0 1px rgba(239,68,68,0.20); }
    50%      { background: rgba(239,68,68,0.18); box-shadow: inset 0 0 0 1px rgba(239,68,68,0.70); }
  }
  .rng.near-high { animation: rng-pulse-high 1.6s ease-in-out infinite; }
  .rng.near-low  { animation: rng-pulse-low 1.6s ease-in-out infinite; }
  .rng.near-high .rng-marker { background: var(--up); box-shadow: 0 0 0 1px var(--up), 0 0 8px rgba(34,197,94,0.7); }
  .rng.near-low  .rng-marker { background: var(--down); box-shadow: 0 0 0 1px var(--down), 0 0 8px rgba(239,68,68,0.7); }
  .rng.soft-high { background: rgba(34,197,94,0.05); }
  .rng.soft-low  { background: rgba(239,68,68,0.05); }
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
  .mode-tabs { display: inline-flex; gap: 0; margin-bottom: 14px; margin-left: 8px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .mode-tabs button { background: transparent; border: none; color: var(--muted); padding: 5px 12px; cursor: pointer; font-size: 12px; font-weight: 500; }
  .mode-tabs button:hover { color: var(--text); }
  .mode-tabs button.active { background: var(--us); color: white; }
  .chart-svg { width: 100%; height: auto; display: block; }
  .chart-loading { color: var(--muted); padding: 60px 20px; text-align: center; font-size: 13px; }
  .chart-meta { color: var(--muted); font-size: 12px; margin-top: 6px; }
  .chart-detail { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0,0,0,0.18); font-size: 13px; min-height: 40px; display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: baseline; color: var(--muted); }
  .chart-detail.placeholder { color: var(--muted); font-size: 12px; justify-content: center; min-height: 36px; }
  .cd-date { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
  .cd-value { color: var(--text); font-variant-numeric: tabular-nums; }
  .cd-ago { color: var(--muted); font-size: 12px; }
  .cd-chg { font-variant-numeric: tabular-nums; font-weight: 600; }
  .cd-chg.up { color: var(--up); }
  .cd-chg.down { color: var(--down); }
  .cd-chg.flat { color: var(--muted); }
  .bar { transition: opacity 0.12s; cursor: pointer; }
  .bar:hover { opacity: 0.75; }
  .bar.selected { stroke: var(--text); stroke-width: 1.2; }
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
    .news-grid.news-grid-2 { grid-template-columns: repeat(2, 1fr); }
  }
  .h2-hint { font-size: 11px; color: var(--muted); font-weight: 400; text-transform: none; letter-spacing: 0; margin-left: 6px; }
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

  <h2>한국 빅테크 (K-Tech)</h2>
  <div class="grid five">${krTechHtml}</div>

  <h2>미국 빅테크 (US Big Tech)</h2>
  <div class="grid five">${usTechHtml}</div>

  <h2>중국 빅테크 (China Tech)</h2>
  <div class="grid five">${cnTechHtml}</div>

  <h2>빅테크 핵심 뉴스 <span class="h2-hint">(주가 영향 키워드 필터)</span></h2>
  <div class="news-grid">
    ${newsSection("한국 빅테크 뉴스", "🇰🇷", news?.kr_tech)}
    ${newsSection("미국 빅테크 뉴스", "🇺🇸", news?.us_tech)}
    ${newsSection("중국 빅테크 뉴스", "🇨🇳", news?.cn_tech)}
  </div>

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
    <div class="mode-tabs" id="mode-tabs" role="tablist" aria-label="차트 모드">
      <button data-mode="value" class="active" title="실제 가격 (Y축 자동 확대)">값</button>
      <button data-mode="change" title="일별 % 변화 (변동성 강조)">변화율</button>
    </div>
    <div id="chart-host"><div class="chart-loading">불러오는 중…</div></div>
    <div id="chart-detail" class="chart-detail" aria-live="polite">막대를 클릭하면 상세 정보가 여기 표시됩니다</div>
    <div id="chart-meta" class="chart-meta"></div>
  </div>
</div>

<script>
(function () {
  var modal = document.getElementById("chart-modal");
  var titleEl = document.getElementById("chart-title");
  var hostEl = document.getElementById("chart-host");
  var metaEl = document.getElementById("chart-meta");
  var detailEl = document.getElementById("chart-detail");
  var tabs = document.getElementById("range-tabs");
  var modeTabs = document.getElementById("mode-tabs");
  var current = { id: null, label: null, range: "1M", mode: "value", series: [], unit: "" };

  function fmtNum(v) {
    if (!isFinite(v)) return "—";
    if (Math.abs(v) >= 1000) return v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
    return v.toFixed(2);
  }
  function fmtVal(v, unit) {
    var s = fmtNum(v);
    if (unit === "원") return s + " 원";
    if (unit === "$") return "$" + s;
    if (unit === "HK$") return "HK$" + s;
    if (unit) return s + unit;
    return s;
  }
  function dateAgo(dateStr) {
    var t = new Date(dateStr).getTime();
    if (!isFinite(t)) return "";
    var days = Math.round((Date.now() - t) / 86400000);
    if (days <= 0) return "오늘";
    if (days === 1) return "어제";
    if (days < 7) return days + "일 전";
    if (days < 30) return Math.floor(days/7) + "주 " + (days%7 ? (days%7)+"일 ":"") + "전 (" + days + "일)";
    if (days < 365) {
      var m = Math.floor(days/30); var rd = days - m*30;
      return m + "개월 " + (rd ? rd+"일 ":"") + "전 (" + days + "일)";
    }
    var y = Math.floor(days/365); var rmd = days - y*365; var rmm = Math.floor(rmd/30);
    return y + "년 " + (rmm ? rmm+"개월 ":"") + "전 (" + days + "일)";
  }
  function resetDetail() {
    detailEl.className = "chart-detail placeholder";
    detailEl.textContent = "막대를 클릭하면 상세 정보가 여기 표시됩니다";
  }
  function showDetail(i) {
    var s = current.series; if (!s[i]) return;
    var p = s[i];
    var prev = i > 0 ? s[i-1] : null;
    var first = s[0];
    var dPrev = prev ? p.value - prev.value : 0;
    var dPrevPct = prev && prev.value ? (dPrev / prev.value) * 100 : 0;
    var dFirst = p.value - first.value;
    var dFirstPct = first.value ? (dFirst / first.value) * 100 : 0;
    function chgChip(pct, abs, label) {
      var dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
      var arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "·";
      return '<span class="cd-chg ' + dir + '">' + arrow + " " + label + " " + (pct>=0?"+":"−") + Math.abs(pct).toFixed(2) + "%</span>";
    }
    detailEl.className = "chart-detail";
    detailEl.innerHTML =
      '<span class="cd-date">' + p.date + "</span>" +
      '<span class="cd-ago">' + dateAgo(p.date) + "</span>" +
      '<span class="cd-value">' + fmtVal(p.value, current.unit) + "</span>" +
      (prev ? chgChip(dPrevPct, dPrev, "전일") : "") +
      chgChip(dFirstPct, dFirst, "기간 시작 대비");
  }

  function open(id, label) {
    current.id = id; current.label = label; current.range = "1M"; current.mode = "value"; current.series = []; current.unit = "";
    setActiveMode("value");
    var card = document.querySelector('[data-series-id="' + id + '"]');
    if (card) {
      var v = card.querySelector(".value");
      if (v) {
        var t = v.textContent || "";
        if (/원/.test(t)) current.unit = "원";
        else if (/HK\$/.test(t)) current.unit = "HK$";
        else if (/^\$/.test(t.trim())) current.unit = "$";
        else if (/%/.test(t)) current.unit = "%";
      }
    }
    setActiveTab("1M");
    titleEl.textContent = label;
    resetDetail();
    modal.classList.remove("hidden");
    load();
  }
  function close() { modal.classList.add("hidden"); }
  function setActiveTab(r) {
    tabs.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.range === r);
    });
  }
  function setActiveMode(m) {
    modeTabs.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === m);
    });
  }
  function redraw() {
    if (!current.series || !current.series.length) return;
    hostEl.innerHTML = drawSvg(current.series, current.mode);
    attachBarHandlers();
    resetDetail();
  }
  async function load() {
    hostEl.innerHTML = '<div class="chart-loading">불러오는 중…</div>';
    metaEl.textContent = "";
    resetDetail();
    try {
      var res = await fetch("/api/series?id=" + encodeURIComponent(current.id) + "&range=" + current.range);
      var data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "HTTP " + res.status);
      var s = data.series || [];
      if (!s.length) { hostEl.innerHTML = '<div class="chart-loading">데이터 없음</div>'; return; }
      current.series = s;
      hostEl.innerHTML = drawSvg(s, current.mode);
      var first = s[0].date, last = s[s.length - 1].date;
      metaEl.textContent = s.length + " 포인트 · " + first + " ~ " + last + " · 막대 클릭 → 상세";
      attachBarHandlers();
    } catch (e) {
      hostEl.innerHTML = '<div class="chart-loading">오류: ' + (e.message || e) + '</div>';
    }
  }
  function attachBarHandlers() {
    var bars = hostEl.querySelectorAll("rect.bar");
    bars.forEach(function (b) {
      b.addEventListener("click", function () {
        bars.forEach(function (x) { x.classList.remove("selected"); });
        b.classList.add("selected");
        showDetail(parseInt(b.getAttribute("data-i"), 10));
      });
    });
  }
  function drawSvg(series, mode) {
    var W = 760, H = 320, P = { top: 14, right: 14, bottom: 30, left: 60 };
    var n = series.length;
    var upColor = "#22c55e", downColor = "#ef4444";
    var plotW = W - P.left - P.right;
    var plotH = H - P.top - P.bottom;
    var slot = plotW / Math.max(n, 1);
    var bw = Math.max(1, Math.min(slot - 1, slot * 0.78));
    // Build per-bar payload depending on mode
    var bars = []; // { i, value, date, color, rawValue }
    if (mode === "change") {
      for (var i = 0; i < n; i++) {
        var pct = (i === 0 || !series[i-1].value) ? 0 : ((series[i].value - series[i-1].value) / series[i-1].value) * 100;
        bars.push({ i: i, value: pct, date: series[i].date, color: pct >= 0 ? upColor : downColor, rawValue: series[i].value });
      }
    } else {
      var firstV = series[0].value, lastV = series[n - 1].value;
      var defaultColor = lastV >= firstV ? upColor : downColor;
      for (var j = 0; j < n; j++) {
        var v = series[j].value;
        var color = j > 0 ? (v >= series[j-1].value ? upColor : downColor) : defaultColor;
        bars.push({ i: j, value: v, date: series[j].date, color: color });
      }
    }
    var ys = bars.map(function (b) { return b.value; });
    var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    var hasNeg = yMin < 0;
    var hasPos = yMax > 0;
    var pad = (yMax - yMin) * 0.08 || Math.abs(yMax || 1) * 0.05 || 1;
    var y0, y1;
    if (mode === "change") {
      // symmetric around 0 for visual balance
      var amax = Math.max(Math.abs(yMin), Math.abs(yMax)) + pad;
      y0 = -amax; y1 = amax;
    } else {
      // tight zoom: don't include 0 baseline — let variation fill the canvas
      y0 = yMin - pad; y1 = yMax + pad;
    }
    if (y0 === y1) y1 = y0 + 1;
    var sy = function (v) { return P.top + (1 - (v - y0) / (y1 - y0)) * plotH; };
    var baselineY = sy(0);
    var rendered = "";
    for (var k = 0; k < bars.length; k++) {
      var b = bars[k];
      var x = P.left + k * slot + (slot - bw) / 2;
      var top, bot;
      if (mode === "change") {
        top = sy(Math.max(b.value, 0));
        bot = sy(Math.min(b.value, 0));
      } else {
        // Anchor to bottom edge of plot so bars don't extend below the visible area
        top = sy(b.value);
        bot = P.top + plotH;
      }
      var h = Math.max(0.5, bot - top);
      var labelV = mode === "change"
        ? (b.value >= 0 ? "+" : "−") + Math.abs(b.value).toFixed(2) + "% (" + (Math.abs(b.rawValue) >= 1000 ? b.rawValue.toFixed(0) : b.rawValue.toFixed(2)) + ")"
        : (Math.abs(b.value) >= 1000 ? b.value.toFixed(0) : b.value.toFixed(2));
      rendered += '<rect class="bar" data-i="' + b.i + '" x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + b.color + '" rx="1"><title>' + b.date + " · " + labelV + '</title></rect>';
    }
    var ticks = 4;
    var grid = "";
    for (var t = 0; t <= ticks; t++) {
      var gv = y0 + (t / ticks) * (y1 - y0);
      var gy = sy(gv);
      var label = mode === "change"
        ? (gv >= 0 ? "+" : "−") + Math.abs(gv).toFixed(1) + "%"
        : (Math.abs(gv) >= 1000 ? gv.toFixed(0) : gv.toFixed(2));
      grid += '<line x1="' + P.left + '" y1="' + gy.toFixed(1) + '" x2="' + (W - P.right) + '" y2="' + gy.toFixed(1) + '" stroke="#232a44" stroke-width="0.5"/>';
      grid += '<text x="' + (P.left - 8) + '" y="' + (gy + 4).toFixed(1) + '" fill="#8a93a6" font-size="11" text-anchor="end">' + label + '</text>';
    }
    var zeroLine = (mode === "change" || (y0 < 0 && y1 > 0))
      ? '<line x1="' + P.left + '" y1="' + baselineY.toFixed(1) + '" x2="' + (W - P.right) + '" y2="' + baselineY.toFixed(1) + '" stroke="#8a93a6" stroke-width="0.8" stroke-dasharray="3 3"/>'
      : "";
    var first = series[0].date, last = series[n - 1].date;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" class="chart-svg">' +
      grid +
      rendered +
      zeroLine +
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
  modeTabs.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-mode]");
    if (!b) return;
    setActiveMode(b.dataset.mode);
    current.mode = b.dataset.mode;
    redraw();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
    if (e.key === "Enter" || e.key === " ") {
      var card = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-series-id]");
      if (card) { e.preventDefault(); open(card.dataset.seriesId, card.dataset.label); }
    }
  });
})();

// Lazy-load 배경 뉴스 reason for alerting cards (큰 변동만)
(function () {
  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function loadReasons() {
    var slots = Array.prototype.slice.call(document.querySelectorAll(".reason-slot[data-reason-for]"));
    if (!slots.length) return;
    var ids = slots.map(function (s) { return s.dataset.reasonFor; }).filter(Boolean);
    // dedupe + cap to 10 (server also caps)
    ids = Array.from(new Set(ids)).slice(0, 10);
    if (!ids.length) return;
    fetch("/api/reasons?ids=" + encodeURIComponent(ids.join(",")))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        slots.forEach(function (slot) {
          var id = slot.dataset.reasonFor;
          var r = data && data[id];
          if (!r || !r.headline) return;
          var koBadge = r.translated ? '<span class="ko-badge" title="한국어 자동 번역">KO</span>' : "";
          var src = r.source ? '<span class="reason-source">' + escapeHtml(r.source) + '</span>' : "";
          var attrs = r.link
            ? 'href="' + escapeHtml(r.link) + '" target="_blank" rel="noopener noreferrer"'
            : "";
          var tag = r.link ? "a" : "div";
          slot.innerHTML = "<" + tag + " " + attrs + ' class="reason-link" onclick="event.stopPropagation()" title="배경 뉴스 원문 보기">' +
            '<span class="reason-ic">📰</span>' +
            '<span class="reason-text">' + koBadge + escapeHtml(r.headline) + '</span>' +
            src +
            '</' + tag + '>';
        });
      })
      .catch(function () { /* silent */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadReasons);
  else loadReasons();
})();
</script>
</body>
</html>`;
}
