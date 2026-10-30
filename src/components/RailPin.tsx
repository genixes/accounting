"use client";

import { useEffect, useState } from "react";
import { Pin } from "lucide-react";

const KEY = "rail-pin";

/** Pins the auto-hiding sidebar open. State lives on #app[data-pin] so the
 *  CSS can react without re-rendering the server layout; the inline script in
 *  the layout restores it before first paint. */
export default function RailPin() {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(document.getElementById("app")?.getAttribute("data-pin") === "1");
  }, []);

  function toggle() {
    const next = !pinned;
    setPinned(next);
    document.getElementById("app")?.setAttribute("data-pin", next ? "1" : "0");
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* storage blocked — the pin just won't persist */
    }
  }

  return (
    <button type="button" className="pin" onClick={toggle} aria-pressed={pinned}
      aria-label={pinned ? "Unpin sidebar (auto-hide)" : "Pin sidebar open"} title={pinned ? "Unpin sidebar" : "Pin sidebar"}>
      <Pin size={14} strokeWidth={2.2} />
    </button>
  );
}
