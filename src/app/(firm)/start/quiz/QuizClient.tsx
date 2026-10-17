"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { submitQuiz, type QuizState } from "./actions";
import type { Question } from "@/lib/firm/quiz";

export default function QuizClient({ questions }: { questions: Question[] }) {
  const [step, setStep] = useState(0); // questions.length === contact step
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState<QuizState, FormData>(submitQuiz, {});
  const heading = useRef<HTMLHeadingElement>(null);

  const total = questions.length + 1;
  const q = questions[step];
  const onContact = step === questions.length;

  // Move focus to the new heading so keyboard and screen-reader users follow the flow.
  useEffect(() => heading.current?.focus(), [step]);

  const choose = (qid: string, value: string) => {
    setAnswers((a) => ({ ...a, [qid]: value }));
    setTimeout(() => setStep((s) => Math.min(s + 1, questions.length)), 180);
  };

  return (
    <div className="narrow qwrap">
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1} aria-label="Progress">
        <i style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      {!onContact && q && (
        <div>
          <div className="qcount tn">Question {step + 1} of {questions.length}</div>
          <h1 className="q" ref={heading} tabIndex={-1}>{q.prompt}</h1>
          {q.hint && <p className="qhint">{q.hint}</p>}
          <ul className="opts" role="radiogroup" aria-label={q.prompt}>
            {q.options.map((o) => (
              <li key={o.value}>
                <button type="button" role="radio" aria-checked={answers[q.id] === o.value} className="opt" onClick={() => choose(q.id, o.value)}>
                  <span>{o.label}</span>
                  <span className="odot" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="qnav">
            <button type="button" className="back" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {answers[q.id] && <button type="button" className="fxb line" onClick={() => setStep(step + 1)}>Next</button>}
          </div>
        </div>
      )}

      {onContact && (
        <form action={formAction} noValidate={false}>
          <div className="qcount">Last step</div>
          <h1 className="q" ref={heading} tabIndex={-1}>Where should we send your result?</h1>
          <p className="qhint">You will see your score straight away. We use these details to set up your workspace if you continue, and to contact you about it.</p>

          {state.error && <div className="ferr" role="alert">{state.error}</div>}
          <input type="hidden" name="answers" value={JSON.stringify(answers)} />

          <div className="f"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} /></div>
          <div className="f"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
            <div className="help">You will sign in with this address.</div></div>
          <div className="f"><label htmlFor="businessName">Business or trade name</label><input id="businessName" name="businessName" autoComplete="organization" required minLength={2} maxLength={80} />
            <div className="help">Your own name is fine if you have no shop name yet.</div></div>
          <div className="f"><label htmlFor="phone">Mobile number <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(optional)</span></label><input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={30} /></div>

          <label className="chk">
            <input type="checkbox" name="consent" required />
            <span>I have read the <Link href="/privacy" target="_blank">privacy notice</Link> and agree that you may process my details to give me my result and contact me.</span>
          </label>

          <div className="qnav" style={{ marginTop: 0 }}>
            <button type="button" className="back" onClick={() => setStep(step - 1)}>Back</button>
            <button type="submit" className="fxb brass" disabled={pending}>{pending ? "Working out your score…" : "See my result"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
