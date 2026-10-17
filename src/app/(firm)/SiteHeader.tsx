import Link from "next/link";
import { BRAND } from "@/lib/firm/brand";

export default function SiteHeader() {
  return (
    <header className="wrap fxtop">
      <Link href="/start" className="logo" aria-label={BRAND.name}>
        {BRAND.name.split(" ")[0]}
        <i>.</i>
      </Link>
      <nav aria-label="Main">
        <Link href="/start#pricing" className="hide-sm">Pricing</Link>
        <Link href="/start#faq" className="hide-sm">Questions</Link>
        <Link href="/login">Client sign in</Link>
      </nav>
    </header>
  );
}
