# MASTER PROMPT — "Lex" Legal Practice OS (Sample Build)

> I-paste ang tibuok sa ubos (gikan sa `=== BEGIN PROMPT ===` hangtod `=== END PROMPT ===`) sa imong AI builder
> (Claude Code, Cursor, Lovable, v0, Bolt, etc.). Kung mo-support ang tool og file attachments, i-attach pud ang `schema.prisma`.

=== BEGIN PROMPT ===

## 1. ROLE

You are a principal full-stack engineer and senior product designer who has shipped
premium enterprise software for law firms and private banks. Build a **fully clickable,
production-looking sample** of a luxury **Legal Practice Operating System** called **"Lex"**.
It is a demo for law-firm partners, so it must look and feel like a six-figure enterprise
product: calm, precise, expensive. No placeholder lorem ipsum, no empty screens, no broken
links. Every screen is populated with believable, internally consistent seed data.

## 2. PRODUCT IN ONE PARAGRAPH

Lex is a **matter-centric** system. The *matter* (a client engagement or case) is the hub.
Time, expenses, documents, deadlines, tasks, communications, invoices, and client trust funds
all hang off a matter. Lex's two money-making promises: **(1) capture every billable minute**
(smart time capture with AI suggestions the lawyer approves) and **(2) make trust (client funds)
accounting impossible to get wrong** (strict ledger, three-way reconciliation, audit trail).

## 3. TECH STACK (use exactly this unless impossible)

- Next.js 15 (App Router) + TypeScript (strict) + React 19
- Tailwind CSS + shadcn/ui primitives + lucide-react icons
- Recharts for charts; Framer Motion for subtle motion
- PostgreSQL + Prisma (use the attached `schema.prisma` as the data model; if not attached,
  create the entities listed in §6)
- Zod for validation; server actions / route handlers for mutations
- Session auth (httpOnly JWT cookie) with role-based access
- `prisma/seed.ts` that creates the full demo dataset (§8)
- Everything runs with: `npm install && npx prisma migrate dev && npm run seed && npm run dev`
- Multi-tenant by `tenantId` on every business table; routes under `/t/[slug]/...`
- Money is `Decimal`, never float. Currency default PHP (₱), configurable per tenant.

## 4. DESIGN SYSTEM — "QUIET LUXURY"

Think private bank meets Linear. Restraint is the luxury.

- **Palette**: deep navy ink `#0B1220`, graphite `#1B2333`, warm ivory background `#FAF8F4`,
  champagne gold accent `#B08D57` (use sparingly: active nav marker, primary CTA hover, key
  numbers, thin dividers), muted slate text `#5B6577`. Status colors desaturated:
  emerald `#2F7D5B`, amber `#B7791F`, crimson `#A23B3B`, sapphire `#2F5D9E`.
- **Dark mode** fully supported (true navy, not gray). Theme toggle in the top bar.
- **Typography**: serif for display/headings (`Fraunces` or `Playfair Display`, tight tracking),
  `Inter` for UI, `JetBrains Mono` / tabular-nums for every money and time figure.
  All numbers right-aligned with tabular figures.
- **Layout**: 264px collapsible left sidebar (logo, firm switcher, nav groups, user card),
  top bar (global search / command palette trigger, notifications, theme, profile),
  content max-width 1440px with generous 32px gutters.
- **Surfaces**: 12px radius cards, 1px hairline borders (`rgba` ink 8%), very soft layered shadows,
  no heavy gradients. One subtle gold hairline under page titles.
- **Motion**: 150–220ms ease-out, skeleton loaders (never spinners on full pages), animated
  number count-up on KPI cards, smooth drawer/sheet transitions, respect `prefers-reduced-motion`.
- **Density**: comfortable by default with a "compact" toggle for tables.
- **Empty/loading/error states** designed for every list (illustration-free, typographic, with a
  clear next action).
- **Accessibility**: WCAG AA contrast, visible focus rings, full keyboard navigation, aria labels.
- **Responsive**: desktop-first but fully usable on tablet and phone (sidebar becomes a sheet,
  tables become cards).

## 5. GLOBAL FEATURES (build these first, used everywhere)

1. **Command palette (⌘K / Ctrl+K)**: search matters, clients, contacts, documents, invoices;
   quick actions ("New matter", "Log time", "Record trust deposit", "Run conflict check");
   recent items; keyboard-first.
2. **Global timer** (persistent pill in the top bar): start/stop/pause, pick matter + activity
   code, description; on stop → creates a DRAFT time entry. Show running time live.
3. **Role-based access** (Owner Partner, Partner, Associate, Paralegal, Accountant, Secretary,
   Client). Hide/disable UI per role. Add a **role switcher in the demo user menu** so a presenter
   can show each view instantly.
4. **Audit trail**: every create/update/approve/send/disburse writes an `AuditLog` row. A reusable
   "History" drawer on matters, invoices, and trust entries shows who/what/when/before→after.
5. **Confidentiality & ethical walls**: restricted matters display a lock badge; users on a wall
   see "Restricted — contact the responsible attorney" instead of content.
6. **Toasts, confirm dialogs, optimistic updates, undo for non-financial actions.**
7. **Export**: CSV for tables, PDF for invoices and reports (print-optimized CSS is acceptable for the demo).

## 6. DATA MODEL (entities — see attached `schema.prisma` for exact fields)

Tenant, TenantBranding, Office, User, Client, Contact (with `aliases[]`), Matter, MatterTeamMember,
MatterParty, ConflictCheck, EthicalWall, RateCard, RateCardLine, TimeEntry, MatterExpense,
Invoice, InvoiceLine, Payment, TrustAccount, TrustLedgerEntry (append-only), TrustReconciliation,
Deadline, Task, Document, DocumentVersion, Communication, AiInteraction, AuditLog (hash-chained).

Hard rules to implement in code AND in the database where possible:
- `TrustLedgerEntry` is **append-only**. Corrections are reversing entries. No UPDATE/DELETE.
- A client's trust sub-ledger balance can **never go below zero**. Reject the disbursement with a
  clear, human error ("Insufficient client trust funds: ₱12,000.00 available").
- Disbursements above a configurable threshold require a **second approver** (two-person rule).
- Invoice numbers are **gapless and sequential** per tenant.
- Time entries are stored in minutes; billing increments (e.g., 6 min) are a firm setting.
- A billed time entry cannot be edited; it can only be written off via a logged adjustment.

## 7. SCREENS (build ALL of these)

### 7.1 Login
Elegant split screen: left = brand panel (navy, subtle gold line pattern, firm tagline);
right = form. Demo-account quick-pick chips (one per role). MFA code step is shown (accept `123456` in demo).

### 7.2 Executive Dashboard (`/dashboard`) — "The Partner's Morning"
- Greeting with date and a one-sentence AI-style daily brief ("3 deadlines this week, ₱1.2M WIP unbilled, 1 trust item needs approval").
- **KPI row** (count-up): Revenue MTD, Work in Progress (unbilled), Collections rate, Realization rate,
  Utilization %, Outstanding A/R. Each with sparkline + delta vs last month.
- **Charts**: Revenue vs target (12 mo, area), A/R aging buckets (bar), Billable hours by practice area
  (donut), Matter profitability ranking (horizontal bars), Timekeeper utilization (heat strip).
- **Attention panel**: upcoming deadlines (next 14 days, color-coded by urgency), invoices awaiting
  partner review, time suggestions awaiting approval, matters over 80% budget, trust items awaiting approval,
  failed/unbalanced reconciliation alerts.
- **Activity feed** from the audit log.

### 7.3 Matters
- **List**: filterable table (status, practice area, responsible attorney, office, client, billing type),
  saved views, column chooser, bulk actions, search, status pills, budget-burn mini bar, next-deadline cell.
- **Matter detail** (`/matters/[id]`) with a sticky header (number, title, client, status, responsible
  attorney avatar stack, budget bar, confidentiality badge, quick actions) and tabs:
  1. **Overview**: key facts, court/case info, parties, team, timeline, financial snapshot
     (WIP, billed, paid, trust balance, budget remaining), AI case summary card with citations.
  2. **Time & Expenses**: entries table (inline edit for drafts), weekly mini-timesheet, add-expense drawer
     with receipt upload, "billable vs written-off" totals.
  3. **Documents**: folder/category tree, grid/list toggle, drag-drop upload (simulated), version history,
     preview pane, legal-hold toggle, tags, full-text search box.
  4. **Deadlines & Tasks**: calendar + list + kanban for tasks; deadline rule-computation dialog
     (enter trigger event + date → show computed due date with rule reference); reminders config.
  5. **Communications**: unified privileged timeline (emails, calls, meetings, notes, portal messages).
  6. **Billing**: invoices for this matter, draft-invoice builder, payments, trust applied.
  7. **Trust**: this matter's trust ledger and balance.
  8. **Team & Access**: members, rate overrides, ethical walls.
  9. **AI Assistant**: chat scoped to this matter; every answer shows source citations
     (document + page + quote) and "Save to matter" / "Mark reviewed" actions. Include disclaimer that
     AI output requires attorney review.
- **New Matter wizard** (4 steps): Client (existing/new + KYC) → **Conflict check** (see 7.4) →
  Engagement & billing terms → Team, budget & deadlines. Ends with generated matter number and
  an engagement-letter preview.

### 7.4 Conflict Check
Search by names/aliases across all clients, contacts, parties, past matters. Fuzzy matching with
similarity score; results grouped by risk (Direct conflict / Potential / Clear) showing the matter,
the role the person played, and responsible attorney. Resolution actions: Clear, Request waiver
(creates a task), Decline. Every run is saved immutably.

### 7.5 Time & Billing
- **Timesheet** (week grid per timekeeper, copy last week, keyboard entry, totals, targets).
- **Smart Capture inbox**: AI-suggested entries from calendar/email/doc edits, each with source icon,
  confidence %, suggested matter + narrative; one-tap Approve / Edit / Dismiss; bulk approve.
- **Pre-bill review**: per matter, partner sees all unbilled time/expenses, can edit narrative, write down
  or write off with reason, and see realization impact live.
- **Invoice builder**: select entries → groups → live PDF-style preview (letterhead from branding),
  discounts, VAT, notes, apply trust funds, save draft → submit for partner review → approve → send
  (simulate email). Statuses and timeline on each invoice.
- **Invoices list** with A/R aging chips, overdue highlighting, record-payment drawer, send reminder action.
- **Rate cards**: manage rates by role/person with effective dates.

### 7.6 Trust Accounting (the crown jewel — make it feel bulletproof)
- **Trust overview**: total client funds held, per-client balances table, accounts list, status of
  last reconciliation, items awaiting approval.
- **Client sub-ledger**: running-balance ledger with deposit / disbursement / transfer-to-operating /
  refund; each row shows approver, reference, cleared status. Reversal entries are visually linked to originals.
- **Record transaction drawer**: validates in real time; shows available balance; blocks overdrafts
  with the exact error text; threshold-based second approval flow; lock icon on approved rows.
- **Three-way reconciliation wizard**: bank balance vs trust journal vs sum of client ledgers; tick off
  cleared items; outstanding items list; big green "Balanced" or red "Variance ₱x" result; sign-off with
  e-signature box; generates a printable reconciliation report.
- **Compliance panel**: dormant-funds alerts, unearned retainer alerts, negative-balance attempts log.

### 7.7 Calendar & Deadlines
Month/week/agenda views; filter by attorney/matter/type; deadline types color-coded; drag to reschedule
non-court items; court deadlines show rule reference and cannot be moved without a reason (logged).

### 7.8 Clients & Contacts
Client list + detail (matters, invoices, trust balance, documents, KYC status, relationship health,
lifetime billing chart). Contact directory with aliases and "appears in N matters".

### 7.9 Documents (firm-wide)
Global library with filters, full-text search with highlighted snippets, recent, legal holds,
document-assembly demo: choose a template (Demand Letter, Engagement Letter, NDA), fill a short form,
see the generated document with merge fields highlighted.

### 7.10 Reports
Prebuilt, filterable, exportable: Realization & Collections, WIP aging, A/R aging, Matter profitability,
Timekeeper productivity, Origination credit, Budget vs actual, Trust reconciliation history,
Conflict-check log. Each with a chart + table + export.

### 7.11 Client Portal (`/portal`)
A separate, lighter, more spacious experience for CLIENT role: their matters with plain-language status,
upcoming dates, shared documents, secure messages, invoices with "Pay now" (simulated), e-sign request,
and trust balance statement. Branded with the firm's logo and colors.

### 7.12 Settings (admin)
Firm profile & branding (live preview of invoice and portal), offices, users & roles, rate cards, billing
increments, numbering formats, trust thresholds, deadline rule sets, integrations page (Outlook, Gmail, Word,
DocuSign, QuickBooks/Xero, e-filing — shown as connected/disconnected cards, simulated), security
(MFA, session list, IP allow-list), audit log viewer with filters and CSV export, data-retention policy.

## 8. SEED DATA (make it rich, consistent, and Philippines-flavored)

- **Firm**: "Reyes Alcantara & Villanueva Law Offices" (Cebu HQ, Makati and Davao branches), PHP.
- **Users (10)**: 2 Owner Partners, 1 Partner, 3 Associates, 2 Paralegals, 1 Accountant, 1 Secretary,
  plus 2 client-portal users. Realistic names, initials avatars, bar numbers.
- **Clients (14)**: mix of individuals and companies (a real-estate developer, a shipping company,
  a BPO firm, a family estate, a hospital group, a cooperative…).
- **Matters (40)**: across Litigation, Corporate, Real Property, Labor, Family, Tax, IP, Estate.
  Mix of statuses; 6 over 80% budget; 3 restricted; 1 with an active ethical wall; hourly, fixed-fee,
  contingency, and retainer arrangements. Realistic titles and case numbers.
- **Time entries (≈900)** spanning 12 months with believable narratives ("Review and annotate lease
  addendum; correspondence with opposing counsel re: turnover schedule"), UTBMS-style activity codes,
  and ~25 AI-SUGGESTED pending entries with confidence scores.
- **Invoices (≈120)** across all statuses; A/R aging populated across every bucket; ≈85% collections rate.
- **Trust**: 6 client trust sub-ledgers with 80–150 entries total, one with a pending second-approval
  disbursement, one reconciliation per month for 6 months (5 balanced, 1 with a ₱ variance explained by an
  outstanding check), one blocked-overdraft attempt in the log.
- **Deadlines (≈60)** with 10 due in the next 14 days (2 critical), **Tasks (≈120)**,
  **Documents (≈200 records, simulated files)** with versions, **Communications (≈300)**.
- **Conflict data**: seed names with aliases so a demo search for "J. Dela Cruz" or "Delacruz Realty"
  visibly returns one direct conflict, two potential conflicts, and a clear result.
- Seed with deterministic randomness (fixed seed) so the demo is identical every run.
- Print demo credentials per role to the console; document them in README.

## 9. AI FEATURES (simulate if no API key; real if `ANTHROPIC_API_KEY` is set)

Abstract behind `lib/ai.ts` with a mock provider (canned but matter-aware responses with citations
pointing at real seeded documents) and an Anthropic provider. Features: matter summary, document
summarization, draft letter/email, natural-language matter search, time-entry suggestions, deadline
extraction from an uploaded pleading. Rules: every output is logged to `AiInteraction`, always
shows citations, always labeled "Draft — attorney review required", and never sends/files anything automatically.

## 10. QUALITY BAR / ACCEPTANCE CRITERIA

- `npm run build` and `npm run lint` pass with zero errors; TypeScript strict with no `any`.
- Every nav item opens a complete, populated page. No dead buttons: if a feature is simulated,
  it shows a realistic result and a toast.
- Lighthouse accessibility ≥ 95 on dashboard and matter detail.
- Trust rules enforced server-side (not only in the UI); include unit tests for: overdraft rejection,
  reversal linking, gapless invoice numbering, two-person approval, billed-entry immutability.
- Consistent component library in `components/ui` and `components/lex/*`; no copy-pasted markup.
- Clear folder structure, a thorough README (setup, demo script, role credentials, architecture
  diagram in Mermaid, data-model overview, design tokens), and a **5-minute demo script** that walks a
  partner through: Dashboard → open a restricted matter → approve AI time suggestions → build and send an
  invoice → attempt a trust overdraft (blocked) → run reconciliation → switch to Client Portal.

## 11. BUILD ORDER

1. Project scaffold, tokens, theme, layout shell, auth + roles, seed skeleton.
2. Schema + migrations + full seed.
3. Matters (list, detail, wizard) + Conflict Check.
4. Time capture, timesheet, pre-bill, invoice builder.
5. Trust accounting + reconciliation.
6. Dashboard + Reports.
7. Calendar, Documents, Clients, AI assistant.
8. Client Portal + Settings + audit log viewer.
9. Polish pass (motion, empty states, responsive, a11y), tests, README, demo script.

Work autonomously through all steps. After each phase, run the app, fix errors, and summarize what
was built. Do not stop to ask questions; choose sensible defaults and note them in the README.

=== END PROMPT ===
