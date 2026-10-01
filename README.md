# Layaw System — Construction Accounting

*SIMPLE · SMART · SOLID*

Multi-tenant construction accounting ledger. Rebuilt from a Google Sheets +
Apps Script system into a Next.js + PostgreSQL app so the same codebase can
serve multiple companies, each with its own branding and module toggles.

## Stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL + Prisma
- Session auth via httpOnly JWT cookie (name + PIN, same as before)

## Local setup

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npx prisma migrate dev
npm run seed            # creates two demo tenants: genixes, cordova
npm run dev
```

Visit `http://localhost:3000/t/genixes/login` or `http://localhost:3000/t/cordova/login`.
The seed script prints each demo user's name and PIN to the console.

## How tenants work

- Each company is a `Tenant` row, reached at `/t/<slug>/...`.
- Branding (logo, company name, 6 hex colors) lives in `TenantBranding` and is
  applied as CSS custom properties per tenant — no code change to rebrand.
- `TenantFeature` rows turn optional modules (payroll, collection, transfers,
  reports, users) on/off per tenant. A role can never use a module its
  tenant's plan doesn't include, even if the role would normally allow it.
- Onboarding a new client today is a manual seed/insert (see
  `prisma/seed.ts` for the shape). A signup flow and billing are not built
  yet — see the plan this was built from for what's intentionally deferred.

## Business rules carried over from the original system

- Append-only registers (Expenses, Payroll, Collection, Transfers). Nothing
  is ever deleted — mistakes are voided (`voidedAt`/`voidReason`), and every
  total excludes voided rows.
- Every write is audited (`AuditLog`).
- Role permissions (Encoder / Foreman / Bookkeeper / Owner) are enforced
  server-side only — see `src/lib/roles.ts`.
