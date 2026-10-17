import type { Metadata } from "next";
import SiteHeader from "../SiteHeader";
import { BRAND, CONSENT_VERSION } from "@/lib/firm/brand";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <div className="narrow qwrap" style={{ lineHeight: 1.7 }}>
        <div className="ferr" style={{ color: "var(--ink)", borderColor: "var(--brass)" }}>
          Draft. This notice has not been reviewed by a lawyer and must be before launch. Version {CONSENT_VERSION}.
        </div>
        <h1 className="q">Privacy notice</h1>

        <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500 }}>What we collect</h2>
        <p>Your name, email address, optional mobile number, business name and your answers to the readiness check. If you become a client, also the financial records you enter into your workspace, and a record of what you and your accountant do in it.</p>

        <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500 }}>Why we use it</h2>
        <p>To show your result, to take payment, to set up and run your workspace, to let your assigned accountant help you, and to contact you about those things. We do not sell your information.</p>

        <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500 }}>Who else handles it</h2>
        <p>Our payment provider handles your payment details; we never see or store card numbers. An email service delivers our messages, and a hosting provider stores our data. Your assigned partner accountant can see your workspace. No other client can.</p>

        <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500 }}>How long we keep it</h2>
        <p>While you are a client, and afterwards for as long as the law requires us to keep accounting records. If you only took the readiness check, we keep your answers until you ask us to delete them.</p>

        <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500 }}>Your rights</h2>
        <p>Under the Data Privacy Act you may ask to see, correct or delete your personal data, and to withdraw your consent. Email <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.</p>
      </div>
    </>
  );
}
