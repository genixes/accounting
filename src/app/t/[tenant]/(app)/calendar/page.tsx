import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { getCalendar } from "@/lib/calendar";
import { REGISTERS } from "@/lib/registers";
import type { RegisterKey } from "@/lib/roles";
import { peso, pesoShort, dmy } from "@/lib/format";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }

export default async function CalendarPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ y?: string; m?: string; day?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);

  const now = new Date();
  const year = Number(sp.y) || now.getFullYear();
  const month = Number(sp.m) || now.getMonth() + 1;

  const c = await getCalendar(tenant.id, session, year, month);
  const lead = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayIso = now.toISOString().slice(0, 10);

  let prevY = year, prevM = month - 1;
  if (prevM < 1) { prevM = 12; prevY--; }
  let nextY = year, nextM = month + 1;
  if (nextM > 12) { nextM = 1; nextY++; }

  const base = `/t/${slug}/calendar`;
  const selectedIso = sp.day;
  const selectedDay = selectedIso ? c.days[selectedIso] : undefined;

  return (
    <>
      <div className="calbar">
        <div>
          <span className="lab">The ledger, by day</span>
          <div className="mo">{MONTHS[month - 1]} {year}</div>
        </div>
        <div className="nav">
          <Link href={`${base}?y=${prevY}&m=${prevM}`}><button type="button">&larr; Prev</button></Link>
          <Link href={`${base}?y=${now.getFullYear()}&m=${now.getMonth() + 1}`}><button type="button">Today</button></Link>
          <Link href={`${base}?y=${nextY}&m=${nextM}`}><button type="button">Next &rarr;</button></Link>
        </div>
      </div>

      <div className="rack">
        <div className="k"><span className="lab">Received</span><div className="v pos">{peso(c.totals.in)}</div><div className="sub">this month</div></div>
        <div className="k"><span className="lab">Paid out</span><div className="v neg">{peso(c.totals.out)}</div><div className="sub">this month</div></div>
        <div className="k"><span className="lab">Net movement</span><div className={`v ${c.totals.net < 0 ? "neg" : "pos"}`}>{peso(c.totals.net, true)}</div><div className="sub">in less out</div></div>
        <div className="k"><span className="lab">Entries</span><div className="v"><span className="num">{c.totals.count}</span></div><div className="sub">recorded this month</div></div>
      </div>

      <div className="cal">
        {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div className="d pad" key={`pad${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = `${year}-${pad2(month)}-${pad2(day)}`;
          const e = c.days[iso];
          const cls = ["d", e ? "has" : "", iso === todayIso ? "today" : ""].filter(Boolean).join(" ");
          const cell = (
            <div className={cls} key={iso}>
              <div className="n">{day}</div>
              {e && (
                <>
                  {e.in > 0 && <div className="m pos">+{pesoShort(e.in)}</div>}
                  {e.out > 0 && <div className="m neg">-{pesoShort(e.out)}</div>}
                  <div className="cnt">{e.entries.length} entr{e.entries.length === 1 ? "y" : "ies"}</div>
                </>
              )}
            </div>
          );
          return e ? <Link href={`${base}?y=${year}&m=${month}&day=${iso}`} key={iso} style={{ color: "inherit", textDecoration: "none" }}>{cell}</Link> : cell;
        })}
      </div>

      {selectedIso && selectedDay && (
        <div className="sheet" style={{ marginTop: 22 }}>
          <div className="hd">
            <div><span className="lab">{dmy(selectedIso)}</span><h2>{selectedDay.entries.length} {selectedDay.entries.length === 1 ? "entry" : "entries"}</h2></div>
            <Link href={base}><button className="btn ghost" type="button" style={{ width: "auto" }}>Close</button></Link>
          </div>
          <div className="bd">
            <div className="rack" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}>
              <div className="k"><span className="lab">Received</span><div className="v pos">{peso(selectedDay.in)}</div></div>
              <div className="k"><span className="lab">Paid out</span><div className="v neg">{peso(selectedDay.out)}</div></div>
            </div>
            {selectedDay.entries.map((x) => {
              const sgn = x.dir === "in" ? "+" : x.dir === "out" ? "-" : "";
              const cls = x.dir === "in" ? "pos" : x.dir === "out" ? "neg" : "";
              return (
                <div key={x.register + x.id} style={{ padding: "13px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span className="id">{x.id}</span>
                    <span className={cls} style={{ fontWeight: 600 }}>{sgn}{peso(x.amount)}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 3 }}>{x.label || ""}</div>
                  <div className="lab" style={{ marginTop: 5 }}>
                    {REGISTERS[x.register as RegisterKey].title}{x.project ? ` · ${x.project}` : ""} &middot; {x.by}
                  </div>
                  {x.voided && <div style={{ marginTop: 7 }}><span className="tag void">Voided</span></div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
