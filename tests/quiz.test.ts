import { describe, expect, it } from "vitest";
import { QUESTIONS, scoreQuiz, isCompleteAnswers } from "@/lib/firm/quiz";

const best = () => Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options.reduce((a, b) => (b.points > a.points ? b : a)).value]));
const worst = () => Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options.reduce((a, b) => (b.points < a.points ? b : a)).value]));

describe("scoreQuiz", () => {
  it("scores a fully organised business at 100 with no gaps", () => {
    const r = scoreQuiz({ ...best(), income: "20-50" });
    expect(r.score).toBe(100);
    expect(r.band).toBe("Well organised");
    expect(r.gaps).toEqual([]);
    expect(r.planKey).toBe("STARTER");
  });

  it("scores a disorganised business at 0 and recommends hands-on help", () => {
    const r = scoreQuiz({ ...worst(), income: "lt20" });
    expect(r.score).toBe(0);
    expect(r.band).toBe("Getting started");
    expect(r.planKey).toBe("GROWTH");
    expect(r.gaps.map((g) => g.id).sort()).toEqual(["deadline", "receipts", "registered", "tracking"]);
    expect(r.needsAccountantReview).toBe(true);
  });

  it("income and business type never change the readiness score", () => {
    const a = scoreQuiz({ ...best(), income: "lt20", business: "freelancer" });
    const b = scoreQuiz({ ...best(), income: "gt150", business: "online-seller" });
    expect(a.score).toBe(b.score);
  });

  it("recommends GROWTH and review for high volume even when organised", () => {
    const r = scoreQuiz({ ...best(), income: "gt150" });
    expect(r.planKey).toBe("GROWTH");
    expect(r.needsAccountantReview).toBe(true);
  });

  it("is deterministic", () => {
    expect(scoreQuiz(best())).toEqual(scoreQuiz(best()));
  });

  it("rejects missing or invalid answers", () => {
    const a = best();
    delete (a as Record<string, string>).tracking;
    expect(() => scoreQuiz(a)).toThrow();
    expect(isCompleteAnswers({ ...best(), tracking: "bogus" })).toBe(false);
    expect(isCompleteAnswers({ ...best(), extra: "x" })).toBe(false);
    expect(isCompleteAnswers(best())).toBe(true);
  });
});
