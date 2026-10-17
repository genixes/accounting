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


---

# Bookkeeping firm (Tala Books) — Phase 1

A second product on the same multi-tenant core: a funnel and back office for
selling bookkeeping and tax-readiness to online sellers and freelancers.
The brand name is a placeholder in `src/lib/firm/brand.ts`.

```
/start            landing -> readiness quiz -> result -> checkout (PayMongo)
                  payment clears -> workspace provisioned -> welcome email
/login            client sign-in by emailed one-time code (no passwords)
/t/<slug>/...     the client's own ledger (Tenant.kind = SELLER)
/admin            staff portal: clients, consults, filing dates, payments, staff
```

## Run it locally

```bash
npm install
cp .env.example .env            # fill DATABASE_URL and JWT_SECRET
npx prisma migrate deploy
npm run seed                    # demo construction tenants
npm run staff:create -- you@firm.ph "Your Name" ADMIN
npm run dev                     # BILLING_PROVIDER=mock, EMAIL_DRIVER=console by default
```

Take the quiz at `/start`. At checkout you land on a local simulator
(`/pay/mock/...`) that sends the same event PayMongo would. Sign-in codes are
printed in the server log. `BILLING_PROVIDER=mock` is refused when
`NODE_ENV=production`.

## Tests

```bash
createdb accounting_test && DATABASE_URL=postgresql://.../accounting_test npx prisma migrate deploy
DATABASE_URL_TEST=postgresql://.../accounting_test npm test
```

Unit tests always run. Integration tests (webhook idempotency, OTP, seller
entries) run only when `DATABASE_URL_TEST` is set, and they TRUNCATE that database.

## Money safety — how payments are handled

- A payment only counts when the webhook's HMAC verifies over the **raw body**.
- Every event is stored first; a unique key makes redelivery a no-op, and an event
  that crashed half-way is finished on the next delivery.
- Paid amount must equal the order amount. Unknown order, unknown amount or a
  mismatch is recorded as `needs_review:*` (shown in /admin) and is **never**
  auto-provisioned and never silently dropped.
- "Paid", provisioning the workspace, the consult request and the emails are
  one database transaction.

## Before going live (not done in code)

1. Verify the PayMongo event/response shapes in **test mode with real keys**
   (see `parsePayMongoEvent`). Anything unparseable lands in `needs_review`.
2. Confirm prices in `src/lib/firm/plans.ts` (placeholders).
3. Have a lawyer review `/privacy` (it shows a draft banner) and the consent flow.
4. Have a CPA confirm every statement in the quiz copy; the app deliberately
   contains no tax rates or deadlines. Filing dates are entered per client by staff.
5. Choose and configure the email provider; set `CRON_SECRET` and schedule
   `POST /api/cron/email` every minute or two.
6. Add a CSP header and rate limiting at the edge (Cloudflare/Vercel).
