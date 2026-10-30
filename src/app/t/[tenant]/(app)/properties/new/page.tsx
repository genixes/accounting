import { guard } from "../guard";
import Flash from "../Flash";
import { createPropertyAction } from "../actions";
import { CURRENCIES } from "@/lib/finance/money";

const TYPES = [["RESIDENTIAL", "Residential"], ["COMMERCIAL", "Commercial"], ["INDUSTRIAL", "Industrial"], ["LAND", "Land"], ["MIXED_USE", "Mixed use"]];

export default async function NewPropertyPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const { tenant } = await guard(slug, true);
  const action = createPropertyAction.bind(null, slug);

  return (
    <>
      <Flash err={sp.err} />
      <div className="pagehd"><div><h1>Add property</h1><div className="sub">Starts at the Prospect stage (BUY)</div></div></div>
      <div className="sheet"><div className="bd">
        <form action={action}>
          <div className="grid2">
            <div className="field"><label className="req" htmlFor="name">Name</label><input id="name" name="name" required /></div>
            <div className="field"><label htmlFor="type">Type</label>
              <select id="type" name="type" defaultValue="RESIDENTIAL">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="currency">Currency</label>
              <select id="currency" name="currency" defaultValue={tenant.baseCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select>
              <div className="hint">The currency this property is bought, rented and sold in.</div></div>
            <div className="field"><label htmlFor="country">Country</label><input id="country" name="country" /></div>
            <div className="field"><label htmlFor="city">City</label><input id="city" name="city" /></div>
            <div className="field"><label htmlFor="address">Address</label><input id="address" name="address" /></div>
            <div className="field money"><label htmlFor="purchasePrice">Purchase / target price</label><input id="purchasePrice" name="purchasePrice" inputMode="decimal" /></div>
            <div className="field"><label htmlFor="purchaseDate">Purchase date</label><input id="purchaseDate" name="purchaseDate" type="date" /></div>
            <div className="field money"><label htmlFor="closingCosts">Closing costs</label><input id="closingCosts" name="closingCosts" inputMode="decimal" /></div>
            <div className="field money"><label htmlFor="currentValue">Current market value</label><input id="currentValue" name="currentValue" inputMode="decimal" /></div>
          </div>
          <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" /></div>
          <button className="btn" type="submit">Create property</button>
        </form>
      </div></div>
    </>
  );
}
