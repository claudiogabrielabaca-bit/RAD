# RAD - Rate Any Day in Human History

RAD is a Next.js app to explore, rate, review and discover any day in human history.

## Stack

- Next.js
- React
- TypeScript
- Prisma
- PostgreSQL
- Railway
- Cloudflare Turnstile
- Resend

## Local development

Run from the project root:

```powershell
npm install
npx prisma generate
npm run dev
```

## Quality checks

Use the full check before pushing important changes:

```powershell
npm run check:full
```

Before a release or deployment-sensitive change:

```powershell
npm run release:check
```

## Production notes

- Production runs on Railway.
- Database migrations should be applied with Prisma migrate deploy.
- Secrets must stay in environment variables, never in the repository.
- Local `.env` files are intentionally ignored.

Expected production start command:

```sh
npx prisma migrate deploy && npx prisma generate && npm run start
```

## Security baseline

- Hashed user sessions.
- Hashed admin sessions.
- Rate-limited public, auth and admin-sensitive endpoints.
- Cloudflare Turnstile on sensitive flows.
- Security headers and CSP configured in `next.config.ts`.
- Production secrets documented through `.env.example` only.

## Repository hygiene

- Do not commit `.env` files.
- Do not commit local SQLite databases.
- Do not commit temporary audit scripts or local backup archives.
- Always run checks before pushing.
