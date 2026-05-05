// 경제지표 발표 일정 — Forex Factory의 무료 thisweek JSON 사용.
// 미국·한국·EU·중국·일본 통화 + High/Medium impact만 필터링.
const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

const IMPORTANT_COUNTRIES = new Set(["USD", "KRW", "EUR", "CNY", "JPY", "GBP"]);

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
      date: e.date || "",         // ISO with TZ (e.g. 2026-05-07T08:30:00-04:00)
      impact: e.impact || "",     // High | Medium
      forecast: e.forecast || "",
      previous: e.previous || "",
      actual: e.actual || "",
    }));
}

export async function buildCalendar() {
  try {
    const events = await fetchEvents();
    return { generatedAt: new Date().toISOString(), events };
  } catch (err) {
    return { generatedAt: new Date().toISOString(), error: err.message, events: [] };
  }
}
