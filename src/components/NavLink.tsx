"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function NavLink({ href, label, icon, exact }: { href: string; label: string; icon: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(href + "/"));
  return (
    <Link href={href} className={active ? "on" : ""}>
      <span className="g">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
