# Layaw Care: Pricing Page + Pitch Deck

> Proposed prices are NOT market-validated. Test with 5-10 clinic owners before publishing.
> Never claim "HIPAA compliant" or "DPA certified" unless legally true. Say "built with privacy in mind".
> Receipts: Layaw Care issues Transaction Receipts only, never Official Receipts.

---

## PART 1: PRICING PAGE

### 1.1 Page copy (ready to use)

**Hero**
- Eyebrow: PRICING
- Headline: Simple pricing. Serious care.
- Sub: One platform for your whole clinic. Pick your specialty, start free for 14 days. Walay credit card.
- Toggle: Monthly | Annual (Libre ang 2 ka bulan)

**Plans (per clinic, per month, PHP)**

| | Starter | Pro (Most Popular) | Enterprise |
|---|---|---|---|
| Tagline | Para sa bag-ong clinic | Para sa clinic nga nagtubo | Para sa multi-branch groups |
| Price | P1,990 | P4,990 | Starts at P14,990 |
| Annual | P19,900/yr | P49,900/yr | Custom |
| CTA | Start free trial | Start free trial | Talk to us |
| Branches | 1 | Up to 5 | Unlimited |
| Users | 3 | 15 | Unlimited |
| Specialty packs | 1 | 2 | Unlimited |
| Storage | 5 GB | 25 GB | 100 GB+ |

**Feature rows**
- Patient 360 records: all
- Smart scheduling + queue: all
- EMR + e-prescriptions + certificates: all
- Billing + Transaction Receipts: all
- Inventory and pharmacy: Pro, Enterprise
- Laboratory and imaging: Pro, Enterprise
- Patient portal + online booking: Pro, Enterprise
- SMS and email reminders: Pro, Enterprise (SMS credits billed per use)
- Layaw Circle loyalty + memberships: Pro, Enterprise
- Analytics + Layaw Score: Pro, Enterprise
- Telehealth: Enterprise
- HMO claims tracker: Enterprise
- White-label branding + API access: Enterprise
- Audit and compliance suite: Enterprise
- Priority support + onboarding call: Enterprise

**Specialty packs section**
Title: "Gihimo para sa imong specialty."
Cards: Dental, Glow (Aesthetic/Derma), Kids, Mama, Vision, Motion, General Clinic. Each shows one signature feature (odontogram, before/after slider, growth charts, prenatal timeline, eye exam + optical POS, session tracker).

**Add-ons**

| Add-on | Price |
|---|---|
| Extra specialty pack | P990/month |
| Extra branch | P1,500/month |
| Extra user | P299/month |
| Data migration (import old records) | From P5,000 one-time |
| Training session | P3,000 per session |
| SMS credits | Pay per use |

**Founding Clinic banner**
"Unang 5 ka clinic: 30-50% off sulod sa 12 ka bulan kapalit sa imong feedback." Show a counter "X of 5 spots left" (manual value).

**Trust strip**
- Your records belong to you: export anytime.
- Each clinic's data is kept separate.
- Role-based access and audit logs.
- Transaction Receipts included. Layaw Care does not issue BIR Official Receipts; clinics keep using their own.

**FAQ**
1. Kinahanglan ba ug credit card sa trial? Dili.
2. Pwede ba ko mo-change sa specialty? Oo, add or swap packs in Settings.
3. Pwede ba ko mo-cancel? Oo, anytime. I-export ang imong data.
4. Naa bay contract? Wala. Monthly or annual.
5. Mo-issue ba ang Layaw Care og Official Receipt? Dili. Transaction Receipt ra. Ang clinic mo-issue sa ilang kaugalingong BIR-registered receipt.
6. Giunsa pag-protect ang data? Separate records per clinic, role-based access, audit logs. (Dili mag-promise og certifications nga wala pa.)
7. Pwede ba ang daghang branch? Oo, depende sa plan.
8. Naa bay setup fee? Wala sa Starter/Pro. Optional paid migration.

**Final CTA**: "Ready nga ang imong pasyente. Andam na ba ang imong clinic?" [Start free trial] [Book a demo]

### 1.2 Complete prompt for the AI (paste to build the page)

```
Build a luxury pricing page for "LAYAW CARE" (tagline: "Care, the way you deserve.")
as a standalone React + TypeScript + Tailwind + Framer Motion route /pricing,
matching the Layaw Care design system: ink navy #0B1B2B, champagne gold #C8A96A,
ivory #FAF7F2, teal #2FA39A; Cormorant Garamond/Playfair headings, Inter body;
glass cards, 16px radius, dark/light mode, fully responsive, WCAG AA.

Sections in order:
1. Hero with headline, sub, and Monthly/Annual toggle (annual shows 2 months free,
   animated price change).
2. Three plan cards (Starter P1,990 / Pro P4,990 "Most Popular" gold-ringed and
   slightly raised / Enterprise from P14,990). Each has tagline, price, CTA, and a
   checklist. Locked features appear greyed with a gold lock icon and tooltip
   "Available on Pro".
3. Sticky comparison table (feature rows by category: Core, Operations,
   Engagement, Enterprise) with check/lock icons; collapses to accordions on mobile.
4. Specialty packs showcase: 7 cards (Dental, Glow, Kids, Mama, Vision, Motion,
   General) with icon, accent color, one signature feature, hover micro-animation.
5. Add-ons table.
6. Plan finder: a 3-question quiz (clinic type, number of doctors, branches) that
   recommends a plan and highlights its card.
7. Savings calculator: inputs = monthly no-shows, average visit fee, reminder
   recovery rate slider; output = estimated monthly value recovered vs plan price
   (label it "estimate, not a guarantee").
8. Founding Clinic banner with spots-left counter.
9. Trust strip (data ownership, separation of clinic data, roles and audit logs,
   Transaction Receipts note: "Layaw Care does not issue Official Receipts").
10. FAQ accordion (8 items from the copy below) and final CTA band.
11. Footer with legal links and "Gihimo uban sa pagpaluyo".

Use the exact copy and prices provided. Mark prices as editable via a single
pricing.config.ts file. No fake certifications or compliance badges. No
testimonials unless clearly labeled "Sample testimonial". PHP currency, en-PH
number formatting. Include an English / Filipino / Cebuano language toggle for
headline, subhead, and CTAs.
```

---

## PART 2: PITCH DECK OUTLINE (clinic owners, 12 slides, ~10 minutes)

Tone: warm, confident, Bisaya/English mix. One idea per slide. Always demo, never just talk.

| # | Slide | Message | Visual |
|---|---|---|---|
| 1 | **Title** | Layaw Care: Care, the way you deserve. | Logo, hero shot of dashboard |
| 2 | **The problem** | Papel, Excel, ug 3 ka lahi-lahi nga apps. Nawala ang records, naay no-show, hinay ang billing. | Messy desk vs clean screen |
| 3 | **What it costs you** | Ang no-shows, nawala nga follow-ups, ug oras sa staff = kita nga nawala. (Gamita ang SIMULATED calculator, ayaw mag-imbento og stats.) | Calculator screen |
| 4 | **The solution** | Usa ka platform, gihimo para sa imong specialty. | One-screen overview |
| 5 | **Live demo A: Front desk** | Scheduling, queue, reminders | 60-90 sec screen walk |
| 6 | **Live demo B: Specialty magic** | Odontogram / Face map / Growth chart (pili base sa audience) | The "wow" screen |
| 7 | **Live demo C: Owner view** | Dashboard, Layaw Score, revenue, inventory alerts | Command Center |
| 8 | **Patient experience** | Portal, online booking, results, loyalty (Layaw Circle) | Phone mockup |
| 9 | **Your data, your control** | Separate records per clinic, roles, audit logs, export anytime. Transaction Receipts; you keep your own BIR receipts. | Shield / lock graphic |
| 10 | **Pricing** | Starter / Pro / Enterprise + Founding Clinic offer | Pricing cards |
| 11 | **How we start** | Free 14-day trial, data migration, training, go-live in ~2 weeks (adjust to your real capacity) | Timeline |
| 12 | **Call to action** | "Mag-start ta karong semana." Book trial, founding spot, contact | QR + contact |

### Appendix (keep ready, show only if asked)
- Security and privacy approach
- Roadmap (HMO claims, telehealth, integrations)
- FAQ and objection handling
- Comparison vs spreadsheets/other software (only verified facts)

### Objection cheat sheet
| Objection | Reply |
|---|---|
| "Mahal." | Ipakita ang calculator: usa ka recovered no-show kada semana ang mobayad sa Starter. (Gamita ang ilang tinuod nga numero.) |
| "Naa nami system." | Libre nga data migration sa Founding clinics; run parallel sa trial. |
| "Dili mi techy." | Training session, Bisaya support, 14-day trial. |
| "Safe ba ang records?" | Separate data per clinic, roles, audit logs, export anytime. Dili mag-promise sa certifications nga wala pa. |
| "Mo-issue ba og Official Receipt?" | Dili. Transaction Receipt ra. Ipadayon ang inyong BIR receipts. |

### Demo checklist
- [ ] Demo tenant matches the prospect's specialty
- [ ] Use fake data only, never real patient data
- [ ] Offline fallback: screen recording of the full demo
- [ ] Tenant switcher ready to show data separation
- [ ] Pricing slide uses the same numbers as the website

### Deck-builder prompt (paste into your AI / slide tool)

```
Create a 12-slide pitch deck for "LAYAW CARE", a multi-tenant clinic management
platform for Philippine clinics (tagline "Care, the way you deserve."). Audience:
clinic owners and doctors. Style: luxury healthcare, ink navy #0B1B2B, champagne
gold #C8A96A, ivory #FAF7F2, teal #2FA39A; serif headings, clean sans body; large
type, minimal text, one idea per slide. Tone: warm, confident, light
Cebuano/Filipino phrases. Slides: 1 Title, 2 Problem, 3 Cost of the problem
(calculator mock, clearly marked illustrative), 4 Solution, 5 Demo front desk,
6 Demo specialty feature (placeholder for screenshot), 7 Demo owner dashboard,
8 Patient portal and loyalty, 9 Data ownership and privacy approach (no
certification claims; note: Transaction Receipts only, not Official Receipts),
10 Pricing (Starter P1,990, Pro P4,990, Enterprise from P14,990, Founding Clinic
30-50% off), 11 Onboarding timeline, 12 Call to action. Add speaker notes per
slide (2-3 sentences, Bisaya/English mix). Do not invent statistics, customer
names, or testimonials; use [placeholder] where real data is needed.
```
