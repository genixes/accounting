"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, glyph, label }: { href: string; glyph: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} className={active ? "on" : ""}>
      <span className="g">{glyph}</span>
      <span>{label}</span>
    </Link>
  );
}
