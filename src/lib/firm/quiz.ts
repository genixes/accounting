import { z } from "zod";
import type { PlanKey } from "./plans";

export const QUIZ_VERSION = "2026-10-v1";

export type Option = { value: string; label: string; points: number };
export type Question = {
  id: string;
  prompt: string;
  hint?: string;
  options: Option[];
};

/**
 * "Readiness" measures how organised the business's records are. It is NOT a
 * tax determination — nothing here asserts a tax rule, rate or deadline.
 * Points are 0–10 per question; higher = more ready.
 */
export const QUESTIONS: Question[] = [
  {
    id: "business",
    prompt: "What best describes your work?",
    options: [
      { value: "online-seller", label: "I sell products online", points: 5 },
      { value: "freelancer", label: "I freelance or work as a VA", points: 5 },
      { value: "both", label: "A bit of both", points: 5 },
      { value: "other", label: "Something else", points: 5 },
    ],
  },
  {
    id: "income",
    prompt: "Roughly how much comes in each month?",
    hint: "Gross sales or fees, before expenses. An estimate is fine.",
    options: [
      { value: "lt20", label: "Under ₱20,000", points: 5 },
      { value: "20-50", label: "₱20,000 – ₱50,000", points: 5 },
      { value: "50-150", label: "₱50,000 – ₱150,000", points: 5 },
      { value: "gt150", label: "More than ₱150,000", points: 5 },
    ],
  },
  {
    id: "registered",
    prompt: "Is your business registered with the BIR?",
    options: [
      { value: "yes", label: "Yes, fully registered", points: 10 },
      { value: "partial", label: "Started, not finished", points: 5 },
      { value: "no", label: "No, not yet", points: 0 },
      { value: "unsure", label: "I am not sure", points: 0 },
    ],
  },
  {
    id: "tracking",
    prompt: "How do you track sales and expenses today?",
    options: [
      { value: "system", label: "Accounting app or system", points: 10 },
      { value: "spreadsheet", label: "Spreadsheet", points: 7 },
      { value: "notebook", label: "Notebook or chat notes", points: 3 },
      { value: "nothing", label: "I do not track them", points: 0 },
    ],
  },
  {
    id: "receipts",
    prompt: "Do you keep receipts or proof for what you spend?",
    options: [
      { value: "always", label: "Always, organised", points: 10 },
      { value: "sometimes", label: "Sometimes", points: 5 },
      { value: "rarely", label: "Rarely or never", points: 0 },
    ],
  },
  {
    id: "deadline",
    prompt: "Do you know your next tax filing deadline?",
    options: [
      { value: "yes", label: "Yes, and I never miss it", points: 10 },
      { value: "roughly", label: "Roughly", points: 4 },
      { value: "no", label: "No idea", points: 0 },
    ],
  },
];

const QUESTION_IDS = QUESTIONS.map((q) => q.id);

export const AnswersSchema = z.object(
  Object.fromEntries(
    QUESTIONS.map((q) => [q.id, z.enum(q.options.map((o) => o.value) as [string, ...string[]])])
  ) as Record<string, z.ZodEnum<[string, ...string[]]>>
).strict();

export type Answers = Record<string, string>;

export type Gap = { id: string; title: string; detail: string };

export type QuizResult = {
  score: number;
  band: "Getting started" | "Partly organised" | "Well organised";
  planKey: PlanKey;
  gaps: Gap[];
  /** Set when volume or setup state means a human accountant should look first. */
  needsAccountantReview: boolean;
};

const GAP_COPY: Record<string, Gap> = {
  registered: {
    id: "registered",
    title: "Confirm your BIR registration status",
    detail: "Your answer suggests registration is unfinished or unclear. An accountant should confirm where you stand before anything else.",
  },
  tracking: {
    id: "tracking",
    title: "Start one reliable record of sales and expenses",
    detail: "Everything else — filing, reports, decisions — depends on having a single, complete record.",
  },
  receipts: {
    id: "receipts",
    title: "Keep proof for every expense",
    detail: "Expenses without proof are hard to defend later. A simple habit fixes this.",
  },
  deadline: {
    id: "deadline",
    title: "Put your filing dates on a calendar",
    detail: "Missing a date is the most avoidable and most expensive mistake. Your accountant will set these for you.",
  },
};

/** Pure and deterministic: same answers, same result. */
export function scoreQuiz(answers: Answers): QuizResult {
  let total = 0;
  let max = 0;
  const gaps: Gap[] = [];

  for (const q of QUESTIONS) {
    const best = Math.max(...q.options.map((o) => o.points));
    const picked = q.options.find((o) => o.value === answers[q.id]);
    if (!picked) throw new Error(`Unanswered or invalid question: ${q.id}`);
    // "business" and "income" describe the business; they are not readiness.
    if (q.id === "business" || q.id === "income") continue;
    total += picked.points;
    max += best;
    if (picked.points < best * 0.6 && GAP_COPY[q.id]) gaps.push(GAP_COPY[q.id]);
  }

  const score = Math.round((total / max) * 100);
  const band = score >= 75 ? "Well organised" : score >= 40 ? "Partly organised" : "Getting started";
  const highVolume = answers.income === "gt150";
  const unregistered = answers.registered === "no" || answers.registered === "unsure";
  const planKey: PlanKey = score < 60 || highVolume ? "GROWTH" : "STARTER";

  return { score, band, planKey, gaps, needsAccountantReview: highVolume || unregistered };
}

export function isCompleteAnswers(raw: unknown): raw is Answers {
  return AnswersSchema.safeParse(raw).success;
}

export { QUESTION_IDS };
