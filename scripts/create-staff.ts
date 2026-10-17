/**
 * Creates (or reactivates) a staff user. The first ADMIN must be made here,
 * because the admin portal itself requires an existing ADMIN to add staff.
 *
 *   npx tsx scripts/create-staff.ts you@firm.ph "Your Name" ADMIN
 */
import { PrismaClient, type StaffRole } from "@prisma/client";

const [emailArg, name, roleArg = "ADMIN"] = process.argv.slice(2);
const ROLES: StaffRole[] = ["ADMIN", "PARTNER", "SUPPORT"];

if (!emailArg || !name || !ROLES.includes(roleArg as StaffRole)) {
  console.error('Usage: npx tsx scripts/create-staff.ts <email> "<name>" [ADMIN|PARTNER|SUPPORT]');
  process.exit(1);
}

const db = new PrismaClient();
const email = emailArg.trim().toLowerCase();
db.staffUser
  .upsert({ where: { email }, create: { email, name, role: roleArg as StaffRole }, update: { name, role: roleArg as StaffRole, active: true } })
  .then((s) => console.log(`Staff ready: ${s.email} (${s.role}). Sign in at /admin/login.`))
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => db.$disconnect());
