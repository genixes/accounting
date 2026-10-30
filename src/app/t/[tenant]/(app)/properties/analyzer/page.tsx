import { guard } from "../guard";
import Flash from "../Flash";
import { CURRENCIES, formatMoney } from "@/lib/finance/money";
import { analyzeDeal, validateDeal, type DealInput } from "@/lib/finance/deal";
import { ProjectionChart } from "@/components/FinanceCharts";
import { pct } from "@/lib/format";

type SP = Record<string, string | undefined>;

// Percent fields are typed as whole percents (20 = 20%) and stored as fractions.
const DEFAULTS = {
  currency: "", price: "1000000", closing: "3", down: "25", rate: "6.5", years: "25", rent: "7500",
  vacancy: "5", opex: "35", rentGrowth: "3", appreciation: "4", hold: "7", selling: "5", target: "8",
};

const n = (v: string | undefined, d: string) => {
  const x = Number(String(v ?? d).replace(/,/g, ""));
  return Number.isFinite(x) ? x : NaN;
};

export default async function AnalyzerPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<SP>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const { tenant } = await guard(slug);
  const v = { ...DEFAULTS, ...Object.fromEntries(Object.entries(sp).filter(([, x]) => x !== undefined)) } as typeof DEFAULTS;
  const currency = v.currency || tenant.baseCurrency;

  const input: DealInput = {
    price: n(v.price, DEFAULTS.price), closingCostPct: n(v.closing, DEFAULTS.closing) / 100, downPaymentPct: n(v.down, DEFAULTS.down) / 100,
    interestRate: n(v.rate, DEFAULTS.rate) / 100, loanYears: n(v.years, DEFAULTS.years), monthlyRent: n(v.rent, DEFAULTS.rent),
    vacancyPct: n(v.vacancy, DEFAULTS.vacancy) / 100, opexPct: n(v.opex, DEFAULTS.opex) / 100,
    annualRentGrowth: n(v.rentGrowth, DEFAULTS.rentGrowth) / 100, annualAppreciation: n(v.appreciation, DEFAULTS.appreciation) / 100,
    holdYears: n(v.hold, DEFAULTS.hold), sellingCostPct: n(v.selling, DEFAULTS.selling) / 100, targetCapRate: n(v.target, DEFAULTS.target) / 100,
  };
  const err = validateDeal(input);
  const r = err ? null : analyzeDeal(input);
  const m = (x: number) => formatMoney(x, currency);
  const p = (x: number | null) => (x === null ? "—" : pct(x));

  const field = (name: keyof typeof DEFAULTS, label: string, hint?: string) => (
    <div className="field" key={name}><label htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={v[name]} inputMode="decimal" />{hint && <div className="hint">{hint}</div>}</div>
  );

  return (
    <>
      <Flash err={err ?? undefined} />
      <div className="pagehd"><div><h1>Deal analyzer</h1><div className="sub">BUY phase · model a purchase before you commit — nothing is saved</div></div></div>

      <div className="sheet"><div className="bd">
        <form method="get">
          <div className="grid2">
            <div className="field"><label htmlFor="currency">Currency</label>
              <select id="currency" name="currency" defaultValue={currency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select></div>
            {field("price", "Purchase price")}
            {field("rent", "Monthly rent (gross)")}
            {field("down", "Down payment %")}
            {field("rate", "Interest rate % / yr")}
            {field("years", "Loan term (years)")}
            {field("closing", "Closing costs %")}
            {field("vacancy", "Vacancy %")}
            {field("opex", "Operating expenses %", "Share of collected rent: tax, insurance, repairs, management")}
            {field("rentGrowth", "Rent growth % / yr")}
            {field("appreciation", "Appreciation % / yr")}
            {field("hold", "Hold period (years)")}
            {field("selling", "Selling costs %")}
            {field("target", "Target cap rate %", "Used to compute your maximum offer")}
          </div>
          <button className="btn" type="submit">Analyze deal</button>
        </form>
      </div></div>

      {r && (
        <>
          <div className="rack">
            <div className="k"><div className="top"><span className="lab">Cap rate</span></div><div className="v">{p(r.capRate)}</div><div className="sub">NOI {m(r.noi)} / yr</div></div>
            <div className="k"><div className="top"><span className="lab">Cash-on-cash</span></div><div className="v" style={{ color: (r.cashOnCash ?? 0) < 0 ? "var(--out)" : undefined }}>{p(r.cashOnCash)}</div><div className="sub">cash flow {m(r.annualCashFlow)} / yr</div></div>
            <div className="k"><div className="top"><span className="lab">IRR ({input.holdYears}y)</span></div><div className="v">{p(r.irr)}</div><div className="sub">equity multiple {r.equityMultiple === null ? "—" : `${r.equityMultiple.toFixed(2)}x`}</div></div>
            <div className="k"><div className="top"><span className="lab">DSCR</span></div><div className="v" style={{ color: r.dscr !== null && r.dscr < 1.2 ? "var(--out)" : undefined }}>{r.dscr === null ? "—" : `${r.dscr.toFixed(2)}x`}</div><div className="sub">{r.dscr !== null && r.dscr < 1.2 ? "below the usual 1.20x lender minimum" : "debt coverage"}</div></div>
            <div className="k"><div className="top"><span className="lab">Cash needed</span></div><div className="v">{m(r.cashInvested)}</div><div className="sub">loan {m(r.loanAmount)} · {m(r.monthlyPayment)}/mo</div></div>
            <div className="k"><div className="top"><span className="lab">Max offer @ {pct(input.targetCapRate)} cap</span></div><div className="v">{r.maxOffer === null ? "—" : m(r.maxOffer)}</div><div className="sub">GRM {r.grm === null ? "—" : r.grm.toFixed(1)}</div></div>
          </div>

          <div className="sheet"><div className="hd"><h2>Projection</h2></div><div className="bd">
            <ProjectionChart currency={currency} data={r.years.map((y) => ({ year: y.year, cashFlow: y.cashFlow, saleProceeds: y.saleProceeds, loanBalance: y.loanBalance }))} />
          </div></div>

          <div className="sheet"><div className="bd flush">
            <table>
              <thead><tr><th>Year</th><th>NOI</th><th>Debt service</th><th>Cash flow</th><th>Loan balance</th><th>Property value</th><th>Sale proceeds</th></tr></thead>
              <tbody>{r.years.map((y) => (
                <tr key={y.year}><td>{y.year}</td><td>{m(y.noi)}</td><td>{m(y.debtService)}</td>
                  <td style={{ color: y.cashFlow < 0 ? "var(--out)" : undefined }}>{m(y.cashFlow)}</td>
                  <td>{m(y.loanBalance)}</td><td>{m(y.propertyValue)}</td><td>{y.saleProceeds ? m(y.saleProceeds) : "—"}</td></tr>
              ))}</tbody>
            </table>
          </div></div>
        </>
      )}
    </>
  );
}
