"use client";

import { useState, useTransition } from "react";
import { saveEntryAction } from "./actions";
import { peso, dmy, todayIso } from "@/lib/format";
import type { FieldDef, RegisterConfig } from "@/lib/registers";
import type { Lists } from "@/lib/validate";
import type { RegisterKey } from "@/lib/roles";

type Props = {
  slug: string;
  regKey: RegisterKey;
  cfg: RegisterConfig;
  lists: Lists;
};

function emptyValues(fields: FieldDef[]): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of fields) v[f.key] = f.type === "date" ? todayIso() : "";
  return v;
}

export default function EntryForm({ slug, regKey, cfg, lists }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => emptyValues(cfg.fields));
  const [step, setStep] = useState<"form" | "review">("form");
  const [missing, setMissing] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(key: string, v: string) {
    setValues((old) => ({ ...old, [key]: v }));
  }

  function goReview() {
    setSavedId(null);
    const miss = cfg.fields.filter((f) => f.required && !values[f.key]?.trim());
    if (miss.length) {
      setMissing(miss.map((f) => f.label));
      return;
    }
    setMissing([]);
    setStep("review");
  }

  function save() {
    setErrors([]);
    startTransition(async () => {
      const result = await saveEntryAction(slug, regKey, values);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setSavedId(result.id);
      setValues(emptyValues(cfg.fields));
      setStep("form");
    });
  }

  if (step === "review") {
    return (
      <div className="sheet" style={{ maxWidth: 560 }}>
        <div className="hd">
          <div>
            <span className="lab">Confirm</span>
            <h2>Check this before saving</h2>
            <div style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 3 }}>
              Once saved, an entry can only be voided. It is never deleted.
            </div>
          </div>
        </div>
        <div className="bd">
          <dl className="review" style={{ margin: 0 }}>
            {cfg.fields.filter((f) => values[f.key]).map((f) => {
              const raw = values[f.key];
              const display = f.type === "money" ? peso(Number(raw)) : f.type === "date" ? dmy(raw) : raw;
              return (
                <div key={f.key}>
                  <dt className="lab" style={{ marginTop: 14 }}>{f.label}</dt>
                  <dd className={f.key === cfg.amountField ? "big" : ""}>{display}</dd>
                </div>
              );
            })}
          </dl>
          <button className="btn" style={{ marginTop: 24 }} onClick={save} disabled={pending}>
            {pending ? "Saving" : `Save ${cfg.title}`}
          </button>
          <button className="btn ghost" onClick={() => setStep("form")} disabled={pending}>Go back and edit</button>
          {errors.length > 0 && (
            <div className="msg err show"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sheet" style={{ maxWidth: 720 }}>
      <div className="hd">
        <div>
          <span className="lab">New entry</span>
          <h2>{cfg.title}</h2>
          <div style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 3 }}>{cfg.sub}</div>
        </div>
      </div>
      <div className="bd">
        <div className="grid2">
          {cfg.fields.map((f) => {
            const style = f.half ? undefined : { gridColumn: "1/-1" };
            return (
              <div className={`field${f.type === "money" ? " money" : ""}`} style={style} key={f.key}>
                <label className={`lab${f.required ? " req" : ""}`} htmlFor={`x_${f.key}`}>{f.label}</label>
                {f.type === "select" ? (
                  <>
                    <select id={`x_${f.key}`} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}>
                      <option value="">Choose</option>
                      {(lists[f.list!] || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {f.list && !lists[f.list].length && (
                      <div className="hint" style={{ color: "var(--out)" }}>The {f.list} list is empty. Ask the Owner to fill it in first.</div>
                    )}
                  </>
                ) : f.type === "textarea" ? (
                  <textarea id={`x_${f.key}`} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
                ) : f.type === "money" ? (
                  <input id={`x_${f.key}`} inputMode="decimal" placeholder="0.00" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
                ) : f.type === "date" ? (
                  <input id={`x_${f.key}`} type="date" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
                ) : (
                  <input id={`x_${f.key}`} type="text" placeholder={f.placeholder || ""} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
                )}
              </div>
            );
          })}
        </div>
        {cfg.note && (
          <div className="hint" style={{ background: "var(--paper)", padding: "11px 13px", borderRadius: 2, marginTop: 4 }}>
            {cfg.note}
          </div>
        )}
        <button className="btn" style={{ marginTop: 20 }} onClick={goReview}>Review before saving</button>
        {missing.length > 0 && (
          <div className="msg err show">Still needed:<ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul></div>
        )}
        {savedId && (
          <div className="msg good show">Saved as <b>{savedId}</b>. The ledger is updated.</div>
        )}
      </div>
    </div>
  );
}
