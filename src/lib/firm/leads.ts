import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { CONSENT_VERSION } from "./brand";
import { AnswersSchema, QUIZ_VERSION, scoreQuiz, type QuizResult } from "./quiz";
import { normaliseEmail } from "./otp";

export const LeadInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().max(254).email(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  businessName: z.string().trim().min(2).max(80),
  consent: z.literal("on", { errorMap: () => ({ message: "Please accept the privacy notice to continue." }) }),
  answers: AnswersSchema,
});

export type SavedLead = { id: string; email: string; result: QuizResult };

/** One lead per email: retaking the quiz refreshes the answers, never duplicates. */
export async function saveLead(input: z.infer<typeof LeadInput>): Promise<SavedLead> {
  const result = scoreQuiz(input.answers);
  const email = normaliseEmail(input.email);
  const data = {
    name: input.name,
    phone: input.phone || null,
    businessName: input.businessName,
    consentAt: new Date(),
    consentVersion: CONSENT_VERSION,
    quizVersion: QUIZ_VERSION,
    answers: input.answers,
    score: result.score,
    planKey: result.planKey,
  };
  const lead = await db.lead.upsert({ where: { email }, create: { email, ...data }, update: data, select: { id: true } });
  return { id: lead.id, email, result };
}
