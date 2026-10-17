import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashPin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { RESERVED_SLUGS, slugify, withSuffix } from "./slug";

// Starter vocabulary for an online seller / freelancer. Editable by the client later.
export const SELLER_CATEGORIES = [
  "Cost of goods",
  "Packaging",
  "Shipping and courier",
  "Platform fees",
  "Advertising",
  "Software and subscriptions",
  "Internet and mobile",
  "Transportation",
  "Professional fees",
  "Other",
];
export const SELLER_PAYMENT_METHODS = ["GCash", "Bank transfer", "Platform payout", "Cash on delivery", "Card"];
export const SELLER_ACCOUNTS: { name: string; kind: "Bank" | "Cash" }[] = [
  { name: "Cash on hand", kind: "Cash" },
  { name: "GCash / e-wallet", kind: "Cash" },
  { name: "Bank account", kind: "Bank" },
];
/** A seller's ledger has no construction projects; every entry files under this one. */
export const DEFAULT_PROJECT = "General";
/** Modules a SELLER workspace does not use. */
export const SELLER_DISABLED_FEATURES = ["payroll", "transfers", "users", "reports"] as const;

async function uniqueSlug(tx: Prisma.TransactionClient, business: string): Promise<string> {
  const base = slugify(business);
  const taken = new Set(
    (await tx.tenant.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((t) => t.slug)
  );
  for (let n = 0; n < 200; n++) {
    const s = withSuffix(base, n);
    if (!taken.has(s) && !RESERVED_SLUGS.has(s)) return s;
  }
  throw new Error("Could not allocate a workspace slug.");
}

/**
 * Creates a client's workspace. Runs inside the payment transaction so that
 * "paid" and "provisioned" can never disagree.
 */
export async function provisionSeller(
  tx: Prisma.TransactionClient,
  lead: { id: string; email: string; name: string; businessName: string },
  orderId: string
): Promise<{ tenantId: string; slug: string }> {
  const slug = await uniqueSlug(tx, lead.businessName);

  const tenant = await tx.tenant.create({
    data: {
      slug,
      name: lead.businessName,
      kind: "SELLER",
      branding: { create: { company: lead.businessName } },
      features: { create: SELLER_DISABLED_FEATURES.map((key) => ({ key, enabled: false })) },
      projects: { create: { name: DEFAULT_PROJECT } },
      accounts: { create: SELLER_ACCOUNTS.map((a) => ({ name: a.name, kind: a.kind })) },
      listItems: {
        create: [
          ...SELLER_CATEGORIES.map((value) => ({ type: "category" as const, value })),
          ...SELLER_PAYMENT_METHODS.map((value) => ({ type: "paymentMethod" as const, value })),
        ],
      },
    },
    select: { id: true, slug: true },
  });

  // Sign-in is by email one-time code; the PIN hash is random and never disclosed.
  await tx.user.create({
    data: {
      tenantId: tenant.id,
      name: lead.name,
      email: lead.email,
      role: "Owner",
      pinHash: await hashPin(randomBytes(32).toString("hex")),
    },
  });

  await audit(tx, tenant.id, null, "System", "System", "PROVISION", null, null, `order ${orderId}`);
  return { tenantId: tenant.id, slug: tenant.slug };
}
