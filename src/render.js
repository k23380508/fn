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
  return `
    <article class="card${hero ? " hero" : ""}">
      <div class="card-head">
        ${regionBadge(item.region)}
        <span class="label">${escape(item.label)}</span>
      </div>
      <div class="value">${escape(fmtValue(item.value, item.unit))}</div>
      <div class="delta ${d.dir}">${escape(d.text)}</div>
      <div class="meta">기준 ${escape(item.date || "")}</div>
    </article>`;
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

export function renderHtml(snapshot) {
  const byId = Object.fromEntries(snapshot.items.map((i) => [i.id, i]));
  const heroIds = ["usd_krw", "us_kr_spread", "kospi", "sp500"];
  const ratesIds = ["kr_base_rate", "us_fed_funds", "kr_10y", "us_10y"];
  const inflationIds = ["kr_cpi_yoy", "us_cpi_yoy"];
  const laborIds = ["kr_unemp", "us_unemp"];
  const assetIds = ["gold", "silver", "copper", "btc"];

  const heroHtml = heroIds.map((id) => card(byId[id] || { id, error: "missing" }, true)).join("");
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
  @media (min-width: 481px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 800px) {
    .grid.hero { grid-template-columns: repeat(4, 1fr); }
    .grid.four { grid-template-columns: repeat(4, 1fr); }
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

  <h2>금리</h2>
  <div class="grid four">${ratesHtml}</div>

  <h2>물가</h2>
  <div class="grid">${inflHtml}</div>

  <h2>고용</h2>
  <div class="grid">${laborHtml}</div>

  <h2>원자재 & 가상자산</h2>
  <div class="grid four">${assetHtml}</div>

  <footer>
    <div>데이터 출처: 한국은행 ECOS · FRED (St. Louis Fed) · Yahoo Finance · CoinGecko</div>
    <div>본 페이지는 정보 제공 목적이며, 투자 권유나 자문이 아닙니다. 데이터는 출처에서 지연되어 제공될 수 있습니다.</div>
  </footer>
</div>
</body>
</html>`;
}
