import "server-only";
import type { TenantKind } from "@prisma/client";
import { REGISTERS, type RegisterConfig } from "@/lib/registers";
import type { RegisterKey } from "@/lib/roles";

/** Words the app uses, by kind of workspace. Construction stays exactly as it was. */
export function vocabFor(kind: TenantKind) {
  const seller = kind === "SELLER";
  return {
    seller,
    appSub: seller ? "Bookkeeping" : "Project Control",
    dashboardSub: seller ? "How your business is doing" : "Overview of your construction business performance",
    revenueLabel: seller ? "Sales" : "Revenue",
    hasProjects: !seller,
  };
}

/** The register's form/labels for a workspace. Never mutates the shared config. */
export function registerFor(kind: TenantKind, key: RegisterKey): RegisterConfig {
  const base = REGISTERS[key];
  if (kind !== "SELLER") return base;

  const noProject = (c: RegisterConfig): RegisterConfig => ({
    ...c,
    required: c.required.filter((f) => f !== "project"),
    fields: c.fields.filter((f) => f.key !== "project"),
  });
  const relabel = (c: RegisterConfig, labels: Record<string, Partial<RegisterConfig["fields"][number]>>): RegisterConfig => ({
    ...c,
    fields: c.fields.map((f) => (labels[f.key] ? { ...f, ...labels[f.key] } : f)),
  });

  if (key === "COLLECTION") {
    return relabel(
      {
        ...noProject(base),
        title: "Sale",
        plural: "Sales",
        sub: "Money received from customers, marketplaces and clients.",
        note: "Net received is computed: sale amount minus tax withheld.",
      },
      {
        particulars: { placeholder: "Order, invoice or client" },
        billAmount: { label: "Sale amount" },
        ewt: { label: "Tax withheld" },
        chequeRef: { label: "Order or reference no." },
      }
    );
  }
  if (key === "EXPENSES") {
    return relabel(
      { ...noProject(base), sub: "Money paid out: supplies, shipping, fees, ads and subscriptions." },
      { supplier: { label: "Supplier or platform" }, invoice: { label: "Receipt no." } }
    );
  }
  return noProject(base);
}
