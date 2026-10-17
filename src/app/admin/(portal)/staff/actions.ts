"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { assertAdmin, staffAudit } from "@/lib/firm/staff";
import { normaliseEmail } from "@/lib/firm/otp";

const Input = z.object({
  email: z.string().trim().max(254).email(),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["ADMIN", "PARTNER", "SUPPORT"]),
});

export async function addStaff(formData: FormData) {
  const staff = await requireStaff(["ADMIN"]);
  assertAdmin(staff);
  const p = Input.safeParse({ email: formData.get("email"), name: formData.get("name"), role: formData.get("role") });
  if (!p.success) redirect("/admin/staff?e=invalid");
  const email = normaliseEmail(p.data.email);

  const existing = await db.staffUser.findUnique({ where: { email } });
  if (existing?.active) redirect("/admin/staff?e=exists");

  await db.$transaction(async (tx) => {
    const s = await tx.staffUser.upsert({
      where: { email },
      create: { email, name: p.data.name, role: p.data.role },
      update: { name: p.data.name, role: p.data.role, active: true },
    });
    await staffAudit(tx, staff, existing ? "STAFF_REACTIVATE" : "STAFF_ADD", "StaffUser", s.id, `${email} ${p.data.role}`);
  });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?ok=1");
}

export async function setStaffActive(staffId: string, active: boolean) {
  const staff = await requireStaff(["ADMIN"]);
  assertAdmin(staff);
  if (staffId === staff.staffId) redirect("/admin/staff?e=self");

  await db.$transaction(async (tx) => {
    const target = await tx.staffUser.findUnique({ where: { id: staffId } });
    if (!target) return;
    if (!active && target.role === "ADMIN") {
      const others = await tx.staffUser.count({ where: { role: "ADMIN", active: true, id: { not: staffId } } });
      if (others === 0) redirect("/admin/staff?e=lastadmin");
    }
    await tx.staffUser.update({ where: { id: staffId }, data: { active } });
    await staffAudit(tx, staff, active ? "STAFF_REACTIVATE" : "STAFF_DEACTIVATE", "StaffUser", staffId, target.email);
  });
  revalidatePath("/admin/staff");
  redirect("/admin/staff?ok=1");
}
