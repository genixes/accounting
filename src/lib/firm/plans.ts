export type PlanKey = "STARTER" | "GROWTH";

export type Plan = {
  key: PlanKey;
  name: string;
  /** Integer centavos. */
  amount: number;
  cadence: string;
  blurb: string;
  includes: string[];
};

// PLACEHOLDER PRICES — the owner sets real pricing before launch. They live in
// one place so changing them cannot desynchronise the UI from the checkout.
export const PLANS: Record<PlanKey, Plan> = {
  STARTER: {
    key: "STARTER",
    name: "Starter",
    amount: 150_000,
    cadence: "one-time",
    blurb: "Get your records in order and know exactly where you stand.",
    includes: [
      "Private bookkeeping workspace",
      "One guided consultation with a partner accountant",
      "Starter chart of categories for your kind of business",
      "A written list of what to fix first",
    ],
  },
  GROWTH: {
    key: "GROWTH",
    name: "Growth",
    amount: 350_000,
    cadence: "first month, then monthly",
    blurb: "A partner accountant keeps your books and filing calendar on track.",
    includes: [
      "Everything in Starter",
      "Monthly bookkeeping review by a partner accountant",
      "Filing calendar maintained for you",
      "Priority support",
    ],
  },
};

export function isPlanKey(v: unknown): v is PlanKey {
  return v === "STARTER" || v === "GROWTH";
}

export function formatPeso(centavos: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(centavos / 100);
}
