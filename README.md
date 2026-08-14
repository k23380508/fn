# fn — KR vs US 거시 대시보드

Cloudflare Worker. 라이브: https://fn.k23380508.workers.dev

- 소스 기준선은 GitHub `k23380508/fn` 의 `main` 브랜치다.
- **`main` 에 push 하면 Cloudflare Workers Builds 가 자동으로 빌드·배포한다.** 수동 `npm run deploy` 금지.
- 작업 규칙·구조·데이터 출처는 [CLAUDE.md](CLAUDE.md) 참조.

```bash
npm install
npm run dev                      # localhost:8787
npx wrangler deploy --dry-run    # 배포 없이 빌드·바인딩 검증
```

> 2026-08-14: 워커·레포 이름이 `mp1` → `fn` 으로 바뀌었다. 구 주소 `mp1.k23380508.workers.dev` 는 죽었다.
