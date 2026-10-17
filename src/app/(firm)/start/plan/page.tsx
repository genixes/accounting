import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "../../SiteHeader";
import { db } from "@/lib/db";
import { getLeadId } from "@/lib/firm/lead-session";
import { isCompleteAnswers, scoreQuiz } from "@/lib/firm/quiz";
import { PLANS, formatPeso } from "@/lib/firm/plans";
import { checkoutAction } from "./actions";

export const metadata: Metadata = { title: "Your result" };
export const dynamic = "force-dynamic";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const sp = await searchParams;
  const leadId = await getLeadId();
  if (!leadId) redirect("/start/quiz");
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || !isCompleteAnswers(lead.answers)) redirect("/start/quiz");

  const result = scoreQuiz(lead.answers);
  const first = lead.name.split(" ")[0];
  const ordered = [PLANS[result.planKey], ...Object.values(PLANS).filter((p) => p.key !== result.planKey)];

  return (
    <>
      <SiteHeader />
      <div className="narrow qwrap">
        <div className="qcount">Your readiness, {first}</div>
        <div className="score">
          <b className="tn">{result.score}</b>
          <span>out of 100. {result.band}.</span>
        </div>

        {result.gaps.length > 0 ? (
          <>
            <h1 className="q" style={{ fontSize: 30 }}>What to fix first</h1>
            <ul className="gaps" style={{ marginTop: 18 }}>
              {result.gaps.map((g) => (
                <li key={g.id}><b>{g.title}</b><span>{g.detail}</span></li>
              ))}
            </ul>
          </>
        ) : (
          <p className="qhint" style={{ marginBottom: 40 }}>Your records are in good shape. A partner accountant can still confirm your filing calendar and keep it that way.</p>
        )}

        {result.needsAccountantReview && (
          <p className="review-note">
            Based on your answers, an accountant should look at your situation before you act on anything here. Your first consultation covers exactly that.
          </p>
        )}

        {sp.error === "payment" && <div className="ferr" role="alert">We could not start the payment. Nothing was charged. Please try again in a moment.</div>}
        {sp.cancelled && <div className="ok">Payment was cancelled. Nothing was charged.</div>}

        <h2 className="q" style={{ fontSize: 30, margin: "0 0 20px" }}>Choose how to continue</h2>
        <div className="plans" style={{ gridTemplateColumns: "1fr" }}>
          {ordered.map((p, i) => (
            <div key={p.key} className={`plan${i === 0 ? " rec" : ""}`} style={i > 0 ? { borderLeft: 0, borderTop: "1px solid var(--ink)" } : undefined}>
              {i === 0 && <span className="tagline">Recommended for your answers</span>}
              <h3>{p.name}</h3>
              <div className="price tn">{formatPeso(p.amount)}</div>
              <div className="cad">{p.cadence}</div>
              <p className="blurb">{p.blurb}</p>
              <ul>{p.includes.map((x) => <li key={x}>{x}</li>)}</ul>
              <form action={checkoutAction.bind(null, p.key)}>
                <button type="submit" className={`fxb block ${i === 0 ? "brass" : "line"}`}>Pay {formatPeso(p.amount)} and continue</button>
              </form>
            </div>
          ))}
        </div>
        <p className="fine">You pay on a secure page by GCash, QR Ph or card. Your workspace opens as soon as payment clears.</p>
      </div>
    </>
  );
}
