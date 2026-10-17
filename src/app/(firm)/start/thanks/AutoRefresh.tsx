"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Polls the server while the payment is confirming; gives up after two minutes. */
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 120_000) return clearInterval(id);
      router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
