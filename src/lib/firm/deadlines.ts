export type DeadlineLike = { dueDate: Date; status: "OPEN" | "DONE" };
export type DeadlineState = { key: "done" | "overdue" | "soon" | "upcoming"; label: string; tone: "go" | "hold" | "void" | "bad" | "" };

const DAY = 86_400_000;

/** Due dates are calendar dates (stored at UTC midnight); compare by whole days in UTC. */
export function classifyDeadline(d: DeadlineLike, now: Date, soonDays = 14): DeadlineState {
  if (d.status === "DONE") return { key: "done", label: "Done", tone: "go" };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((d.dueDate.getTime() - today) / DAY);
  if (days < 0) return { key: "overdue", label: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "bad" };
  if (days === 0) return { key: "soon", label: "Due today", tone: "hold" };
  if (days <= soonDays) return { key: "soon", label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "hold" };
  return { key: "upcoming", label: "Upcoming", tone: "" };
}
