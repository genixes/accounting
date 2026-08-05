import "server-only";
import { db } from "@/lib/db";
import type { Lists } from "@/lib/validate";
import type { Session } from "@/lib/auth";

/** The unfiltered lists for a tenant — used for validation, where a Foreman's
 *  entry must still be checked against every real project name that exists. */
export async function allLists(tenantId: string): Promise<Lists> {
  const [projects, items, accounts] = await Promise.all([
    db.project.findMany({ where: { tenantId }, select: { name: true }, orderBy: { name: "asc" } }),
    db.listItem.findMany({ where: { tenantId }, select: { type: true, value: true } }),
    db.account.findMany({ where: { tenantId }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    projects: projects.map((p) => p.name),
    categories: items.filter((i) => i.type === "category").map((i) => i.value),
    paymentMethods: items.filter((i) => i.type === "paymentMethod").map((i) => i.value),
    suppliers: items.filter((i) => i.type === "supplier").map((i) => i.value),
    accounts: accounts.map((a) => a.name),
  };
}

/** Lists as a given session should see them — a Foreman only ever sees the
 *  projects they're assigned to, mirroring getLists() in Code.gs. */
export async function listsForSession(tenantId: string, session: Session): Promise<Lists> {
  const lists = await allLists(tenantId);
  if (session.perms.projectLimited && session.projects.length) {
    return { ...lists, projects: lists.projects.filter((p) => session.projects.includes(p)) };
  }
  return lists;
}
