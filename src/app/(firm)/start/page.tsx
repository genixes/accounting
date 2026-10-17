import Link from "next/link";
import SiteHeader from "../SiteHeader";
import { BRAND } from "@/lib/firm/brand";
import { PLANS, formatPeso } from "@/lib/firm/plans";

const SAMPLE = [
  { d: "Oct 02", t: "Marketplace payout", a: 4231050, k: "in" },
  { d: "Oct 04", t: "GCash — direct orders", a: 1845000, k: "in" },
  { d: "Oct 09", t: "Courier and shipping", a: -512000, k: "out" },
  { d: "Oct 12", t: "Platform and ad fees", a: -834620, k: "out" },
  { d: "Oct 15", t: "Packaging", a: -128000, k: "out" },
] as const;

const peso = (c: number) => {
  const s = Math.abs(c / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return c < 0 ? `(${s})` : s;
};

export default function StartPage() {
  const total = SAMPLE.reduce((n, r) => n + r.a, 0);
  return (
    <>
      <SiteHeader />
      <main>
        <div className="wrap hero">
          <div>
            <h1>Know where the money went, and what is due next.</h1>
            <p className="lede">
              A private ledger and a partner accountant for online sellers and freelancers in the Philippines.
              Start with a two-minute check of how ready your records are.
            </p>
            <div className="cta-row">
              <Link href="/start/quiz" className="fxb brass">Check my readiness</Link>
              <Link href="#how" className="fxb line">See how it works</Link>
            </div>
            <p className="fine">Free. Six questions. It tells you what to fix first, not what tax you owe.</p>
          </div>

          <figure className="ledger" aria-label="Sample month in the ledger" style={{ margin: 0 }}>
            <h2>October, sample shop</h2>
            <div className="lsub">An illustration of the ledger you would get.</div>
            <div className="rules"><table>
              <thead>
                <tr><th>Date</th><th>Entry</th><th className="r">Amount (₱)</th></tr>
              </thead>
              <tbody>
                {SAMPLE.map((r) => (
                  <tr key={r.t}>
                    <td>{r.d}</td>
                    <td>{r.t}</td>
                    <td className={`r tn ${r.k}`}>{peso(r.a)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td />
                  <td>Left after costs</td>
                  <td className="r tn amt">{peso(total)}</td>
                </tr>
              </tbody>
            </table></div>
            <div className="flag"><b>Filing calendar</b><span>Your accountant sets your dates. Nothing is left to memory.</span></div>
          </figure>
        </div>

        <section className="sec" id="what">
          <div className="wrap fxtwo">
            <h2 className="sect">Everything in one place, kept by a person who checks it.</h2>
            <dl className="def">
              <div><dt>A ledger made for sellers</dt><dd>Record sales, platform fees, shipping and ads in minutes. Nothing is ever deleted: a mistake is voided with a reason, so your history stays honest.</dd></div>
              <div><dt>A partner accountant</dt><dd>A real accountant reviews your books and keeps your filing calendar. You ask them questions; the software does not pretend to answer them.</dd></div>
              <div><dt>Reports you can hand over</dt><dd>Monthly summaries and a full audit trail, ready for a bank, a partner or an examiner.</dd></div>
              <div><dt>Private by default</dt><dd>Your workspace is separate from every other client. Only you and your assigned accountant can open it.</dd></div>
            </dl>
          </div>
        </section>

        <section className="sec deep" id="how">
          <div className="wrap fxtwo">
            <h2 className="sect">From first question to first review.</h2>
            <ol className="steps">
              <li><div><h3>Take the readiness check</h3><p>Six questions about how you track sales, expenses and filing today. You get a score and a short list of what to fix first.</p></div></li>
              <li><div><h3>Choose a plan</h3><p>We recommend one based on your answers. You can pick either. Pay by GCash, QR Ph or card.</p></div></li>
              <li><div><h3>Your workspace opens</h3><p>It is ready as soon as payment clears, set up for an online shop or freelance practice, with your first sign-in link by email.</p></div></li>
              <li><div><h3>Meet your accountant</h3><p>A partner accountant contacts you to schedule your first consultation and agree your filing calendar.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="sec" id="pricing">
          <div className="wrap">
            <h2 className="sect">Two plans. Pay once you know which fits.</h2>
            <p style={{ color: "var(--ink-2)", maxWidth: "46ch", margin: "0 0 40px" }}>
              Prices are in pesos. Take the readiness check first and we will tell you which plan matches your answers.
            </p>
            <div className="plans">
              {Object.values(PLANS).map((p) => (
                <div className="plan" key={p.key}>
                  <h3>{p.name}</h3>
                  <div className="price tn">{formatPeso(p.amount)}</div>
                  <div className="cad">{p.cadence}</div>
                  <p className="blurb">{p.blurb}</p>
                  <ul>{p.includes.map((i) => <li key={i}>{i}</li>)}</ul>
                  <Link href="/start/quiz" className={p.key === "GROWTH" ? "fxb brass block" : "fxb line block"}>
                    Start with the readiness check
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" id="faq">
          <div className="wrap fxtwo">
            <h2 className="sect">Questions people ask first.</h2>
            <div>
              <details>
                <summary>What does the readiness check measure?</summary>
                <p>How organised your records are: whether you track sales and expenses, keep proof, and know your filing dates. It does not decide what tax you owe. Only an accountant can do that.</p>
              </details>
              <details>
                <summary>Who does the accounting work?</summary>
                <p>A partner accountant assigned to you. The software keeps the records tidy; your accountant reviews them and answers your questions.</p>
              </details>
              <details>
                <summary>What happens to my information?</summary>
                <p>We collect only what we need to set up your workspace and contact you. Each client&apos;s data is kept apart from every other client&apos;s. Read the <Link href="/privacy">privacy notice</Link>.</p>
              </details>
              <details>
                <summary>How do I sign in later?</summary>
                <p>With your email address. We send a one-time code each time, so there is no password to forget or leak.</p>
              </details>
              <details>
                <summary>Which payment methods do you accept?</summary>
                <p>GCash, QR Ph and cards, through our payment provider. We never see or store your card details.</p>
              </details>
            </div>
          </div>
        </section>
      </main>
      <footer>
        <div className="wrap">
          <span>{BRAND.name}</span>
          <span><Link href="/privacy">Privacy notice</Link> &nbsp;·&nbsp; <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></span>
        </div>
      </footer>
    </>
  );
}
