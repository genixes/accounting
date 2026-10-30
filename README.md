# Layaw System — Construction Accounting

*Simple. Smart. Solid.*

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

## Real-estate vertical (Phase 1)

A tenant's `vertical` is chosen at onboarding: `CONSTRUCTION` (the original
project ledger) or `REAL_ESTATE`. Real-estate tenants also get an
`investorMode` (`SOLO` or `SYNDICATION`, which enables investor stakes per
property) and a `baseCurrency` that all portfolio totals are reported in.

- **Lifecycle** — BUY → RENT → HOLD → SELL as a state machine
  (`src/lib/finance/lifecycle.ts`); every stage change is recorded.
- **Multi-currency** — each property books in its own currency; every posting
  freezes the FX rate (`FxRate`) in effect on its date. Posting without a
  rate is refused rather than assuming 1:1.
- **Double-entry ledger** — `JournalEntry`/`JournalLine`, append-only with
  void. Users pick a transaction type (rent received, repairs, ...) and the
  debit/credit pair is derived. P&L and cash flow come from the lines.
- **Rent roll** — units and leases per property, occupancy and monthly rent.
- **Finance library** — `src/lib/finance/*` is pure and tested
  (`npm test`): IRR/XIRR/NPV, cap rate, cash-on-cash, DSCR, amortization, FX.

Demo: `npm run seed` also creates `/t/realty` (Ana Harbor / 1234).

## Documents vault & alerts (Phase 3)

- Files live in S3-compatible object storage (AWS S3, Cloudflare R2, Supabase
  Storage, MinIO) behind a small driver interface (`src/lib/storage`). Set
  `STORAGE_BUCKET` + credentials (see `.env.example`). **Required in
  production** — without it the app refuses to start storing rather than
  write legal documents to an ephemeral disk. Outside production it falls
  back to `.data/uploads`.
- Uploads are validated by magic bytes (the filename is never trusted), capped
  at 10 MB, stored under a server-generated tenant-scoped key, and served only
  through an authenticated, tenant-checked route as attachments.
- Removing a document voids the row and keeps the file (append-only, like the
  rest of the books).
- "Needs attention" on the portfolio is computed on demand: lease ends, document
  expiries (insurance, permits), loan maturities, and vacant units.

Not built yet: market research automation, exit-strategy engine, investor
portal, PDF statements, email/push delivery of alerts.
