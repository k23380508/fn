# mp1 — KR vs US 거시 대시보드

Cloudflare Worker. 배포: https://mp1.k23380508.workers.dev
Repo: https://github.com/k23380508/mp1
워커 이름: `mp1` (wrangler.jsonc — 변경 금지, 변경 시 배포 URL 죽음)

## 변경 시 영향 매트릭스 (필수 — 변경 전 확인)

데이터 shape이 source → snapshot → cache → render → DOM 여러 층을 흐르므로, 한 곳만 고치면 다른 층 즉시 깨짐. 변경 전 grep으로 사용처 확인 + 영향받는 모든 지점을 같은 commit에 묶을 것.

| 변경 대상 | 동시 확인·수정 필요 지점 |
|---|---|
| `snapshot.js` 카드 필드 추가/변경 | render.js 카드 렌더 함수, kv.js 캐시 schema(필요 시 versioned key), /api/snapshot consumers |
| `snapshot.js` 새 카드 추가 (BUILDERS+order) | render.js 섹션·heroIds 배치, **render.js `CHARTABLE_IDS` Set + series.js `SERIES_REGISTRY`도 같이 추가** (모달 차트 가능하도록), **배포 후 `curl ?fresh=1` 호출 필수** (KV 90분 캐시라 ?fresh 안 부르면 90분간 새 카드 안 보임), CLAUDE.md 카드 표 |
| 차트 모달 동작 변경 (render.js script) | /api/series 응답 schema, KV 캐시 (series:id:range), CHARTABLE_IDS, CLAUDE.md 라우트 표 |
| Alert 임계값 변경 (render.js `ALERT_PCT`) | 동시에 모든 카드 색상/pulse 영향, 사용자 인지 균형 (너무 낮으면 노이즈, 너무 높으면 무의미). 카드별 차등 필요시 alertClass()를 region/id 기반으로 분기 |
| stats schema 변경 (snapshot.js `STATS_WINDOWS`/`computeStats`) | render.js statsBlock/rangeBar 표시, KV 캐시 무효화 또는 key bump 필요, /api/snapshot consumers, 카드 높이 변동 (그리드 레이아웃 영향) |
| 새 region/카테고리 추가 (예: KR_TECH, CN, EU 등) | render.js regionBadge() switch + .badge.<class> CSS, snapshot.js BUILDERS+order, series.js SERIES_REGISTRY, render.js CHARTABLE_IDS, render.js 새 섹션 HTML+heroIds/equityIds/...Ids 변수, **새 통화면 fmtValue() 분기** (예: HK$, ¥, €), CLAUDE.md 카드 표 |
| 빅테크 종목 추가/제거 (snapshot.js `BIGTECH` 배열) | series.js SERIES_REGISTRY 동기화, render.js {kr,us,cn}TechIds 배열, news.js 검색 query 동기화, render.js 빅테크 뉴스 newsSection 호출 동기화, KV cache key bump (snapshot/news 모두) |
| 뉴스 source 변경 (news.js URL/parse) | KV 캐시 (news:v2:latest, TTL 15분), render.js newsSection HTML/CSS, /api/news consumers, CLAUDE.md 출처 표 |
| 뉴스 schema 변경 (kr/us/ai 추가/제거, 번역 토글) | render.js newsSection 호출 + grid columns(.news-grid 768+), KV cache key 버전 bump (news:v3:...) — 옛 cache 자동 무효화, /api/news consumers, CLAUDE.md |
| Workers AI 번역 모델 변경 | wrangler.jsonc ai binding (변경 금지), news.js translateToKo() 모델명·prompt schema, 번역 실패 fallback 동작 (원문 표시) |
| `sources/*.js` 응답 shape 변경 | snapshot.js 의 해당 카드 함수, render.js fmt 로직, sparkline 시계열(series.js) |
| KV `MACRO_CACHE` schema 변경 | kv.js, snapshot.js 캐시 read/write, 기존 캐시 invalidate 또는 versioned key (`v2:snapshot` 등) |
| 라우트 추가 (index.js) | render.js 의 `<link>`/`<a>`, AGENTS.md, 본 CLAUDE.md 라우트 표 |
| wrangler.jsonc 바인딩 변경 | 코드의 `env.<binding>` 모든 사용처, secrets 재투입(`wrangler secret put`) |
| compatibility_date / flags 변경 | nodejs_compat 의존 코드 회귀 테스트, `wrangler deploy --dry-run` 빌드 확인 |
| favicon/SVG 디자인 변경 | render.js `<link>`, 캐시 무효화 (필요 시 query string version) |

**금지**: "일단 핵심만 고치고 나머지는 나중에" — 연쇄 깨짐 1순위 원인. grep 생략 금지. 데이터 shape 변경 후 한 층만 수정 금지.

## 자동 push (필수)

모든 commit은 **즉시** GitHub origin으로 push. commit과 push는 한 단위.

- main push 차단 시 자동 우회: `fix/`·`feat/`·`wip/`·`chore/`·`data/<topic>` 브랜치 생성 후 push, PR 링크 안내
- 세션 종료 전 `git status` clean + `git log @{u}..` 비어있어야 함 (미푸시 0)
- push 전 staged diff에서 secret/.env 확인
- `git push --force` 금지 (사용자가 명시 요청해도 한 번 더 확인)
- 상세는 글로벌 메모리 [auto_push_rule.md] 참조

## 다중 기기/세션 작업 규칙 (필수)

이 프로젝트는 iCloud Drive(`~/Library/Mobile Documents/.../ID/VC/mp1`)에 있어 여러 기기에서 동시 접근 가능. iCloud의 비동기 파일 sync와 git이 충돌하면 `.git/index` 깨짐, ref 분기, 미푸시 손실 발생.

**모든 세션에서 반드시 따른다:**

### 세션 시작 시 (작업 시작 전 항상)
1. `git status` — 미커밋 변경 확인
2. `git pull --ff-only origin main` — 원격이 앞서 있으면 가져옴. **non-fast-forward면 즉시 STOP**, 사용자에게 alert (다른 기기 작업과 분기됨)
3. iCloud placeholder가 있으면 `brctl download .` 로 강제 다운로드
4. `npm install` — package-lock 변경됐을 수 있음

### 작업 중
5. **작은 단위로 commit** — 큰 변경 누적 금지 (다른 기기와 충돌 시 손실 커짐)
6. WIP도 반드시 브랜치로 push: `wip/<topic>` (잃지 않기)
7. 동시에 다른 기기서 dev server 띄우지 않기 (포트·`.wrangler/` 캐시 충돌)

### 세션 종료 전 (필수)
8. `git status` — working tree clean 확인
9. `git push origin <branch>` — **미푸시 0개 보장**
10. 30초 대기 — iCloud 메뉴바 아이콘이 "Updated" 될 때까지 (다른 기기 즉시 사용 시)

### 절대 금지
- iCloud sync에 의존해서 git 없이 다른 기기로 옮기기 (`.git/` 부분 sync 시 repo 깨짐)
- 미푸시 상태로 다른 기기 시작 (분기 발생 → 오늘처럼 수동 cherry-pick 필요)
- 두 기기 동시 작업 (한 시점에 한 기기만)
- `git push --force` (다른 기기 미푸시 작업 날아감)

## 프로젝트 구조

```
src/
├── index.js        라우터 (/, /api/snapshot, /api/series, /api/news, /healthz, /favicon.{ico,svg})
├── render.js       HTML 렌더링 + 모달 클라 JS + CHARTABLE_IDS Set
├── snapshot.js     19개 KR/US 거시 지표 집계 (BUILDERS + order)
├── series.js       SERIES_REGISTRY + fetchSeries(id, range) — 차트 모달용 시계열 (1M/3M/6M/1Y/5Y, YoY 자동 계산)
├── kv.js           MACRO_CACHE KV (snapshot 90분, series 1시간, news 30분)
└── sources/
    ├── ecos.js     한국은행 ECOS API
    ├── fred.js     FRED (St. Louis Fed)
    ├── yahoo.js    Yahoo Finance v8 chart (single quote + series)
    ├── coingecko.js CoinGecko (BTC fallback)
    └── news.js     Google News RSS (KR/US 경제 뉴스 5개씩)
```

## 바인딩 / 환경

- KV: `MACRO_CACHE` (id `4b024d35834f4d85b912e903fc785e36`) — wrangler.jsonc, 변경 금지
- AI: `env.AI` (Workers AI binding) — `@cf/meta/m2m100-1.2b` 영→한 뉴스 제목 번역
- Secrets: ECOS API key, FRED API key (각 source에서 `env.*`로 참조 — `wrangler secret put`로 관리)
- compatibility_date: 2026-05-02

## 배포

```bash
npm run dev      # localhost:8787
npm run deploy   # mp1.k23380508.workers.dev
npx wrangler tail mp1   # 라이브 로그
```

배포 전 `git status` clean 확인 → 배포 후 `git push` (배포본과 git이 일치해야 함).

## 데이터 출처 / 정책

- 한국은행 ECOS · FRED · Yahoo Finance · CoinGecko · Google News (RSS) · Cloudflare Workers AI (m2m100, 영→한 번역)
- 추측 금지 — 출처에서 받은 값만 표시, fallback 없으면 "—"
- 페이지 하단 출처 표기 유지
