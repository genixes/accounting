"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function NavLink({ href, label, icon, exclude }: { href: string; label: string; icon: ReactNode; exclude?: string }) {
  const pathname = usePathname();
  // `exclude` is a sibling route that shares this href as a prefix (properties vs properties/fx).
  const active = pathname === href || (pathname.startsWith(href + "/") && !(exclude && (pathname === exclude || pathname.startsWith(exclude + "/"))));
  return (
    <Link href={href} className={active ? "on" : ""}>
      <span className="g">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
