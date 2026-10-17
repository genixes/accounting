import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/firm/brand";
import "./firm.css";

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
};

export default function FirmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fx">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap"
      />
      {children}
    </div>
  );
}
