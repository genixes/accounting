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

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
