import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

async function seedTenant(opts: {
  slug: string;
  name: string;
  branding: { company: string; ink: string; accent: string; accent2: string; positive: string; negative: string; paper: string; logoUrl?: string };
  disabledFeatures: string[];
  users: { name: string; role: "Owner" | "Bookkeeper" | "Foreman" | "Encoder"; pin: string; projects?: string[] }[];
  projects: { no: string; name: string; client: string; contract: number; status: string }[];
  accounts: { name: string; kind: "Bank" | "Cash"; openingBalance: number }[];
  categories: string[];
  paymentMethods: string[];
  suppliers: string[];
  seedEntries: boolean;
}) {
  console.log(`\n--- seeding ${opts.slug} ---`);

  const tenant = await db.tenant.upsert({
    where: { slug: opts.slug },
    update: {},
    create: { slug: opts.slug, name: opts.name },
  });

  await db.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: opts.branding,
    create: { tenantId: tenant.id, ...opts.branding },
  });

  for (const key of opts.disabledFeatures) {
    await db.tenantFeature.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { enabled: false },
      create: { tenantId: tenant.id, key, enabled: false },
    });
  }

  const projects = [];
  for (const p of opts.projects) {
    const project = await db.project.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: p.name } },
      update: {},
      create: {
        tenantId: tenant.id, no: p.no, name: p.name, client: p.client,
        contract: p.contract, status: p.status, startDate: new Date("2026-01-15"),
      },
    });
    projects.push(project);
  }

  const accounts = [];
  for (const a of opts.accounts) {
    const acct = await db.account.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: a.name } },
      update: {},
      create: { tenantId: tenant.id, name: a.name, kind: a.kind, openingBalance: a.openingBalance },
    });
    accounts.push(acct);
  }

  for (const c of opts.categories) {
    await db.listItem.upsert({
      where: { tenantId_type_value: { tenantId: tenant.id, type: "category", value: c } },
      update: {}, create: { tenantId: tenant.id, type: "category", value: c },
    });
  }
  for (const m of opts.paymentMethods) {
    await db.listItem.upsert({
      where: { tenantId_type_value: { tenantId: tenant.id, type: "paymentMethod", value: m } },
      update: {}, create: { tenantId: tenant.id, type: "paymentMethod", value: m },
    });
  }
  for (const s of opts.suppliers) {
    await db.listItem.upsert({
      where: { tenantId_type_value: { tenantId: tenant.id, type: "supplier", value: s } },
      update: {}, create: { tenantId: tenant.id, type: "supplier", value: s },
    });
  }

  const users: Record<string, { id: string }> = {};
  for (const u of opts.users) {
    const user = await db.user.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: u.name } },
      update: {},
      create: { tenantId: tenant.id, name: u.name, role: u.role, pinHash: await hashPin(u.pin), active: true },
    });
    users[u.name] = user;
    if (u.projects?.length) {
      await db.userProject.deleteMany({ where: { userId: user.id } });
      const assigned = projects.filter((p) => u.projects!.includes(p.name));
      if (assigned.length) {
        await db.userProject.createMany({ data: assigned.map((p) => ({ userId: user.id, projectId: p.id })) });
      }
    }
  }

  if (opts.seedEntries && projects.length) {
    const owner = opts.users.find((u) => u.role === "Owner")!;
    const bank = accounts.find((a) => a.kind === "Bank") || accounts[0];
    const cash = accounts.find((a) => a.kind === "Cash") || accounts[0];

    async function nextId(register: string, prefix: string) {
      const year = 2026;
      const rows = await db.$queryRaw<{ lastNumber: number }[]>`
        INSERT INTO "EntrySequence" ("tenantId", "register", "year", "lastNumber")
        VALUES (${tenant.id}, ${register}, ${year}, 1)
        ON CONFLICT ("tenantId", "register", "year")
        DO UPDATE SET "lastNumber" = "EntrySequence"."lastNumber" + 1
        RETURNING "lastNumber"
      `;
      return `${prefix}-${year}-${String(rows[0].lastNumber).padStart(6, "0")}`;
    }

    await db.expense.create({
      data: {
        tenantId: tenant.id, entryId: await nextId("EXPENSES", "EXP"),
        date: new Date("2026-07-10"), particulars: "Cement and rebar",
        projectId: projects[0].id, category: opts.categories[0] || "Materials",
        supplier: opts.suppliers[0], amount: 185000, paidFrom: bank.name,
        byUserId: users[owner.name].id, byName: owner.name,
      },
    });
    await db.expense.create({
      data: {
        tenantId: tenant.id, entryId: await nextId("EXPENSES", "EXP"),
        date: new Date("2026-07-22"), particulars: "Fuel for equipment",
        projectId: projects[0].id, category: opts.categories[1] || "Fuel",
        amount: 12500, paidFrom: cash.name,
        byUserId: users[owner.name].id, byName: owner.name,
      },
    });
    await db.collection.create({
      data: {
        tenantId: tenant.id, entryId: await nextId("COLLECTION", "COL"),
        date: new Date("2026-07-05"), particulars: "1st billing - downpayment",
        projectId: projects[0].id, billAmount: 500000, ewt: 10000,
        paymentMethod: opts.paymentMethods[0] || "Bank Transfer", depositedTo: bank.name,
        byUserId: users[owner.name].id, byName: owner.name,
      },
    });

    if (!opts.disabledFeatures.includes("payroll")) {
      await db.payroll.create({
        data: {
          tenantId: tenant.id, entryId: await nextId("PAYROLL", "PAY"),
          payPeriod: "July 01-05, 2026", payDate: new Date("2026-07-06"),
          projectId: projects[0].id, workers: "12", regularPay: 84000, otPay: 6000,
          paidBy: bank.name, byUserId: users[owner.name].id, byName: owner.name,
        },
      });
    }
    if (!opts.disabledFeatures.includes("transfers")) {
      await db.transfer.create({
        data: {
          tenantId: tenant.id, entryId: await nextId("TRANSFERS", "TRF"),
          date: new Date("2026-07-08"), particulars: "Fund the petty cash box",
          fromAccount: bank.name, toAccount: cash.name, amount: 20000,
          byUserId: users[owner.name].id, byName: owner.name,
        },
      });
    }
  }

  console.log(`Tenant "${opts.name}" ready at /t/${opts.slug} — sign in as any user above with their PIN.`);
  for (const u of opts.users) console.log(`  ${u.name} (${u.role}) — PIN ${u.pin}`);
}

async function main() {
  // Tenant 1 — fully featured, house blue theme (same palette as the original workbook).
  await seedTenant({
    slug: "genixes",
    name: "Genixes Builders",
    branding: {
      company: "Genixes Builders", ink: "#101634", accent: "#2E4ABE", accent2: "#32A9DC",
      positive: "#0C6B59", negative: "#C0242E", paper: "#EEF1F7",
    },
    disabledFeatures: [],
    users: [
      { name: "Nard Bersales", role: "Owner", pin: "1234" },
      { name: "Book Bea", role: "Bookkeeper", pin: "2222" },
      { name: "Fred Foreman", role: "Foreman", pin: "3333", projects: ["Riverside Residence"] },
      { name: "Erin Encoder", role: "Encoder", pin: "4444" },
    ],
    projects: [
      { no: "PRJ-001", name: "Riverside Residence", client: "Dela Cruz Family", contract: 4200000, status: "Ongoing" },
      { no: "PRJ-002", name: "Hilltop Warehouse", client: "Genixes Logistics", contract: 8800000, status: "Ongoing" },
    ],
    accounts: [
      { name: "BDO Main", kind: "Bank", openingBalance: 500000 },
      { name: "Petty Cash", kind: "Cash", openingBalance: 30000 },
    ],
    categories: ["Materials", "Fuel", "Permits", "Equipment Rental", "Subcontractor"],
    paymentMethods: ["Bank Transfer", "Cheque", "Cash"],
    suppliers: ["ABC Hardware", "Metro Cement Supply"],
    seedEntries: true,
  });

  // Tenant 2 — a second client on the same codebase: different branding,
  // Payroll and Transfers turned off (that client runs payroll elsewhere).
  await seedTenant({
    slug: "cordova",
    name: "Cordova Construction",
    branding: {
      company: "Cordova Construction", ink: "#2B1B12", accent: "#C1531B", accent2: "#E8A33D",
      positive: "#3F7D4A", negative: "#B23A2E", paper: "#FBF1E7",
    },
    disabledFeatures: ["payroll", "transfers"],
    users: [
      { name: "Mia Cordova", role: "Owner", pin: "1234" },
      { name: "Bea Reyes", role: "Bookkeeper", pin: "2222" },
    ],
    projects: [
      { no: "C-001", name: "Seaside Resort Phase 1", client: "Cordova Leisure Corp", contract: 15000000, status: "Ongoing" },
    ],
    accounts: [
      { name: "Metrobank Ops", kind: "Bank", openingBalance: 1200000 },
      { name: "Site Cash", kind: "Cash", openingBalance: 50000 },
    ],
    categories: ["Materials", "Permits", "Labor Contract"],
    paymentMethods: ["Bank Transfer", "Cheque"],
    suppliers: ["Cebu Builders Depot"],
    seedEntries: true,
  });
}

// Demo real-estate tenant: syndication mode, USD reporting, one USD and one
// PHP property so multi-currency conversion is visible out of the box.
async function seedRealEstate() {
  console.log("\n--- seeding realty ---");
  const tenant = await db.tenant.upsert({
    where: { slug: "realty" },
    update: {},
    create: { slug: "realty", name: "Harbor Capital Realty", vertical: "REAL_ESTATE", investorMode: "SYNDICATION", baseCurrency: "USD" },
  });
  await db.tenantBranding.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, company: "Harbor Capital Realty", ink: "#14213D", accent: "#B8893B", accent2: "#2E6F95", positive: "#1F7A5A", negative: "#B23A2E", paper: "#F4F1EA" },
  });
  for (const u of [{ name: "Ana Harbor", role: "Owner" as const, pin: "1234" }, { name: "Ben Ledger", role: "Bookkeeper" as const, pin: "2222" }]) {
    await db.user.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: u.name } },
      update: {},
      create: { tenantId: tenant.id, name: u.name, role: u.role, pinHash: await hashPin(u.pin), active: true },
    });
  }
  if ((await db.realProperty.count({ where: { tenantId: tenant.id } })) > 0) return;

  const chart = [
    ["1000", "Cash & Bank", "ASSET", true], ["1500", "Real Property", "ASSET", false], ["2000", "Mortgage / Loans Payable", "LIABILITY", false],
    ["2100", "Tenant Deposits", "LIABILITY", false], ["3000", "Owner / Investor Capital", "EQUITY", false], ["4000", "Rental Income", "INCOME", false],
    ["4100", "Other Income", "INCOME", false], ["4900", "Gain on Sale", "INCOME", false], ["5000", "Repairs & Maintenance", "EXPENSE", false],
    ["5100", "Property Tax", "EXPENSE", false], ["5200", "Insurance", "EXPENSE", false], ["5300", "Utilities", "EXPENSE", false],
    ["5400", "Management Fees", "EXPENSE", false], ["5500", "Loan Interest", "EXPENSE", false], ["5900", "Other Expense", "EXPENSE", false],
  ] as const;
  const acct: Record<string, string> = {};
  for (const [code, name, type, isCash] of chart) {
    const a = await db.ledgerAccount.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } }, update: {},
      create: { tenantId: tenant.id, code, name, type, isCash },
    });
    acct[code] = a.id;
  }
  await db.fxRate.create({ data: { tenantId: tenant.id, fromCcy: "PHP", toCcy: "USD", rate: 0.0172, asOf: new Date("2026-01-01"), source: "seed" } });

  const mk = (name: string, currency: string, city: string, country: string, price: number, value: number, units: [string, number, string | null, string?][]) =>
    db.realProperty.create({
      data: {
        tenantId: tenant.id, name, type: "RESIDENTIAL", stage: "LEASED", currency, city, country,
        purchasePrice: price, purchaseDate: new Date("2026-01-10"), closingCosts: price * 0.02, currentValue: value,
        stageEvents: { create: [{ toStage: "PROSPECT", byName: "seed" }, { fromStage: "PROSPECT", toStage: "LEASED", byName: "seed", note: "Seeded as leased" }] },
        units: { create: units.map(([label, rent, tenantName, leaseEnd]) => ({
          label, marketRent: rent,
          ...(tenantName ? { leases: { create: { tenantName, monthlyRent: rent, startDate: new Date("2026-02-01"), endDate: leaseEnd ? new Date(leaseEnd) : null } } } : {}),
        })) },
      },
    });
  const austin = await mk("Maple Court Duplex", "USD", "Austin", "USA", 480000, 515000, [["A", 2100, "J. Rivera"], ["B", 2100, null]]);
  const cebu = await mk("Cebu IT Park Condo", "PHP", "Cebu", "Philippines", 6500000, 6900000, [["12F", 38000, "K. Tan", "2026-11-20"]]);

  await db.loan.create({ data: { propertyId: austin.id, lender: "Lone Star Bank", principal: 384000, annualRate: 0.065, termYears: 30, startDate: new Date("2026-02-01") } });

  let n = 0;
  const post = (propertyId: string, currency: string, fx: number, date: string, memo: string, debit: string, credit: string, amount: number) =>
    db.journalEntry.create({
      data: {
        tenantId: tenant.id, entryNo: `JE-2026-${String(++n).padStart(6, "0")}`, date: new Date(date), memo, propertyId, currency, fxToBase: fx,
        byUserId: "seed", byName: "seed",
        lines: { create: [{ accountId: acct[debit], debit: amount, credit: 0 }, { accountId: acct[credit], debit: 0, credit: amount }] },
      },
    });
  for (const m of ["2026-03", "2026-04", "2026-05", "2026-06"]) {
    await post(austin.id, "USD", 1, `${m}-05`, "Rent received: Unit A", "1000", "4000", 2100);
    await post(cebu.id, "PHP", 0.0172, `${m}-05`, "Rent received: Unit 12F", "1000", "4000", 38000);
  }
  await post(austin.id, "USD", 1, "2026-04-18", "Repairs & maintenance: HVAC service", "5000", "1000", 640);
  await post(austin.id, "USD", 1, "2026-05-02", "Property tax: Q2", "5100", "1000", 1800);
  await post(cebu.id, "PHP", 0.0172, "2026-05-10", "Utilities: association dues", "5300", "1000", 9500);
  await db.entrySequence.upsert({
    where: { tenantId_register_year: { tenantId: tenant.id, register: "JOURNAL", year: 2026 } },
    update: { lastNumber: n }, create: { tenantId: tenant.id, register: "JOURNAL", year: 2026, lastNumber: n },
  });
  console.log('Tenant "Harbor Capital Realty" ready at /t/realty — Ana Harbor (Owner) PIN 1234, Ben Ledger (Bookkeeper) PIN 2222.');
}

main()
  .then(() => seedRealEstate())
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
