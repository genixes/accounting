import { Receipt, Banknote, HandCoins, ArrowLeftRight, type LucideIcon } from "lucide-react";
import type { RegisterKey } from "@/lib/roles";

export const REGISTER_ICON: Record<RegisterKey, LucideIcon> = {
  EXPENSES: Receipt,
  PAYROLL: Banknote,
  COLLECTION: HandCoins,
  TRANSFERS: ArrowLeftRight,
};
