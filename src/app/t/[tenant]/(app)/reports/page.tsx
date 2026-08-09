import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { allLists } from "@/lib/lists";

export default async function ReportsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.canReport || !tenant.features.reports) redirect(`/t/${slug}/dashboard`);

  const lists = await allLists(tenant.id);
  const base = `/t/${slug}/reports`;

  return (
    <div className="two">
      <div className="sheet">
        <div className="hd"><div><span className="lab">Internal, per project</span><h2>Project Detail View</h2></div></div>
        <div className="bd">
          <form action={`${base}/detail`} method="get">
            <div className="field">
              <label className="lab req" htmlFor="pd-project">Project</label>
              <select id="pd-project" name="project" required>
                {lists.projects.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid2">
              <div className="field"><label className="lab" htmlFor="pd-from">From</label><input id="pd-from" type="date" name="from" /></div>
              <div className="field"><label className="lab" htmlFor="pd-to">To</label><input id="pd-to" type="date" name="to" /></div>
            </div>
            <button className="btn" type="submit">Generate</button>
          </form>
        </div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">Client-facing, printable</span><h2>Project Report</h2></div></div>
        <div className="bd">
          <form action={`${base}/project`} method="get">
            <div className="field">
              <label className="lab req" htmlFor="pr-project">Project</label>
              <select id="pr-project" name="project" required>
                {lists.projects.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid2">
              <div className="field"><label className="lab" htmlFor="pr-from">From</label><input id="pr-from" type="date" name="from" /></div>
              <div className="field"><label className="lab" htmlFor="pr-to">To</label><input id="pr-to" type="date" name="to" /></div>
            </div>
            <button className="btn" type="submit">Generate</button>
          </form>
        </div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">Every job, one window</span><h2>Period Report</h2></div></div>
        <div className="bd">
          <form action={`${base}/period`} method="get">
            <div className="grid2">
              <div className="field"><label className="lab" htmlFor="pe-from">From</label><input id="pe-from" type="date" name="from" /></div>
              <div className="field"><label className="lab" htmlFor="pe-to">To</label><input id="pe-to" type="date" name="to" /></div>
            </div>
            <button className="btn" type="submit">Generate</button>
          </form>
        </div>
      </div>
    </div>
  );
}
