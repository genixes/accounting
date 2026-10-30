"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard, dateOf, numOf, strOf } from "./guard";
import {
  addFxRate, addLoan, addUnitWithLease, changeStage, createProperty, postTransaction, setStakes, voidEntry,
} from "@/lib/realestate";
import { STAGES, type Stage } from "@/lib/finance/lifecycle";

const back = (slug: string, path: string, err?: string, ok?: string) => {
  const q = err ? `?err=${encodeURIComponent(err)}` : ok ? `?ok=${encodeURIComponent(ok)}` : "";
  redirect(`/t/${slug}/properties${path}${q}`);
};

export async function createPropertyAction(slug: string, fd: FormData) {
  const { session } = await guard(slug, true);
  const r = await createProperty(session, {
    name: strOf(fd.get("name")), type: strOf(fd.get("type")), currency: strOf(fd.get("currency")),
    address: strOf(fd.get("address")), city: strOf(fd.get("city")), country: strOf(fd.get("country")),
    purchasePrice: numOf(fd.get("purchasePrice")), purchaseDate: dateOf(fd.get("purchaseDate")),
    closingCosts: numOf(fd.get("closingCosts")) ?? 0, currentValue: numOf(fd.get("currentValue")), notes: strOf(fd.get("notes")),
  });
  if (!r.ok) back(slug, "/new", r.error);
  else {
    revalidatePath(`/t/${slug}/properties`);
    back(slug, `/${r.id}`, undefined, "Property created.");
  }
}

export async function changeStageAction(slug: string, id: string, fd: FormData) {
  const { session } = await guard(slug, true);
  const to = strOf(fd.get("to"));
  if (!(STAGES as readonly string[]).includes(to)) return back(slug, `/${id}`, "Unknown stage.");
  const r = await changeStage(session, id, to as Stage, strOf(fd.get("note")), numOf(fd.get("salePrice")));
  revalidatePath(`/t/${slug}/properties`);
  back(slug, `/${id}`, r.ok ? undefined : r.error, r.ok ? "Stage updated." : undefined);
}

export async function postTxnAction(slug: string, id: string, fd: FormData) {
  const { tenant, session } = await guard(slug);
  const date = dateOf(fd.get("date"));
  if (!date) return back(slug, `/${id}`, "Enter a valid date.");
  const r = await postTransaction(session, tenant.baseCurrency, {
    propertyId: id, kind: strOf(fd.get("kind")), date, amount: numOf(fd.get("amount")) ?? NaN, memo: strOf(fd.get("memo")),
  });
  revalidatePath(`/t/${slug}/properties`);
  back(slug, `/${id}`, r.ok ? undefined : r.error, r.ok ? `Posted ${r.entryNo}.` : undefined);
}

export async function voidEntryAction(slug: string, propertyId: string, entryId: string, fd: FormData) {
  const { session } = await guard(slug);
  const r = await voidEntry(session, entryId, strOf(fd.get("reason")));
  revalidatePath(`/t/${slug}/properties`);
  back(slug, `/${propertyId}`, r.ok ? undefined : r.error, r.ok ? "Entry voided." : undefined);
}

export async function addUnitAction(slug: string, id: string, fd: FormData) {
  const { session } = await guard(slug, true);
  const r = await addUnitWithLease(session, {
    propertyId: id, label: strOf(fd.get("label")), marketRent: numOf(fd.get("marketRent")) ?? 0,
    tenantName: strOf(fd.get("tenantName")), monthlyRent: numOf(fd.get("monthlyRent")) ?? undefined,
    deposit: numOf(fd.get("deposit")) ?? 0, startDate: dateOf(fd.get("startDate")) ?? undefined, endDate: dateOf(fd.get("endDate")),
  });
  revalidatePath(`/t/${slug}/properties`);
  back(slug, `/${id}`, r.ok ? undefined : r.error, r.ok ? "Unit saved." : undefined);
}

export async function setStakesAction(slug: string, id: string, fd: FormData) {
  const { session } = await guard(slug, true);
  const names = fd.getAll("investor").map(strOf);
  const pcts = fd.getAll("percent").map((v) => numOf(v) ?? 0);
  const r = await setStakes(session, id, names.map((investor, i) => ({ investor, percent: pcts[i] })));
  back(slug, `/${id}`, r.ok ? undefined : r.error, r.ok ? "Stakes saved." : undefined);
}

export async function addFxAction(slug: string, fd: FormData) {
  const { session } = await guard(slug, true);
  const asOf = dateOf(fd.get("asOf"));
  if (!asOf) return back(slug, "/fx", "Enter a valid date.");
  const r = await addFxRate(session, { from: strOf(fd.get("from")), to: strOf(fd.get("to")), rate: numOf(fd.get("rate")) ?? NaN, asOf });
  revalidatePath(`/t/${slug}/properties`);
  back(slug, "/fx", r.ok ? undefined : r.error, r.ok ? "Rate saved." : undefined);
}

export async function addLoanAction(slug: string, id: string, fd: FormData) {
  const { session } = await guard(slug, true);
  const startDate = dateOf(fd.get("startDate"));
  if (!startDate) return back(slug, `/${id}`, "Enter a valid start date.");
  const r = await addLoan(session, {
    propertyId: id, lender: strOf(fd.get("lender")), principal: numOf(fd.get("principal")) ?? NaN,
    annualRatePct: numOf(fd.get("rate")) ?? NaN, termYears: numOf(fd.get("termYears")) ?? NaN, startDate,
  });
  revalidatePath(`/t/${slug}/properties`);
  back(slug, `/${id}`, r.ok ? undefined : r.error, r.ok ? "Loan added." : undefined);
}
