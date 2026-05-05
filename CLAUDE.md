# mp1 — KR vs US 거시 대시보드

Cloudflare Worker. 배포: https://mp1.k23380508.workers.dev
Repo: https://github.com/k23380508/mp1
워커 이름: `mp1` (wrangler.jsonc — 변경 금지, 변경 시 배포 URL 죽음)

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
├── index.js        라우터 (/, /api/snapshot, /healthz, /favicon.{ico,svg})
├── render.js       HTML 렌더링
├── snapshot.js     12개 KR/US 거시 지표 집계 + sparkline
├── kv.js           MACRO_CACHE KV 90분 캐시
├── series.js       sparkline 시계열 처리 (WIP)
├── worker.js       (사용 안 함 — index.js가 진입점)
└── sources/
    ├── ecos.js     한국은행 ECOS API
    ├── fred.js     FRED (St. Louis Fed)
    ├── yahoo.js    Yahoo Finance v8 chart
    └── coingecko.js CoinGecko (BTC fallback)
```

## 바인딩 / 환경

- KV: `MACRO_CACHE` (id `4b024d35834f4d85b912e903fc785e36`) — wrangler.jsonc, 변경 금지
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

- 한국은행 ECOS · FRED · Yahoo Finance · CoinGecko
- 추측 금지 — 출처에서 받은 값만 표시, fallback 없으면 "—"
- 페이지 하단 출처 표기 유지
