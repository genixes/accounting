import type { Role } from "@prisma/client";

export type RegisterKey = "EXPENSES" | "PAYROLL" | "COLLECTION" | "TRANSFERS";

export type RolePerms = {
  add: RegisterKey[];
  canVoid: boolean;
  seeAllEntries: boolean;
  canReport: boolean;
  canManageUsers: boolean;
  projectLimited: boolean;
};

// What each role is allowed to do. Ported 1:1 from the Apps Script ROLES
// config (Code.gs) — same shape, same rules, enforced server-side only.
export const ROLES: Record<Role, RolePerms> = {
  Encoder: {
    add: ["EXPENSES", "PAYROLL", "COLLECTION", "TRANSFERS"],
    canVoid: false,
    seeAllEntries: false,
    canReport: false,
    canManageUsers: false,
    projectLimited: false,
  },
  Foreman: {
    add: ["EXPENSES", "PAYROLL"],
    canVoid: false,
    seeAllEntries: false,
    canReport: false,
    canManageUsers: false,
    projectLimited: true,
  },
  Bookkeeper: {
    add: ["EXPENSES", "PAYROLL", "COLLECTION", "TRANSFERS"],
    canVoid: true,
    seeAllEntries: true,
    canReport: true,
    canManageUsers: false,
    projectLimited: false,
  },
  Owner: {
    add: ["EXPENSES", "PAYROLL", "COLLECTION", "TRANSFERS"],
    canVoid: true,
    seeAllEntries: true,
    canReport: true,
    canManageUsers: true,
    projectLimited: false,
  },
};

export function permsFor(role: Role): RolePerms {
  return ROLES[role];
}
