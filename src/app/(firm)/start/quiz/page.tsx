import type { Metadata } from "next";
import SiteHeader from "../../SiteHeader";
import QuizClient from "./QuizClient";
import { QUESTIONS } from "@/lib/firm/quiz";

export const metadata: Metadata = { title: "Readiness check" };

export default function QuizPage() {
  return (
    <>
      <SiteHeader />
      <QuizClient questions={QUESTIONS} />
    </>
  );
}
