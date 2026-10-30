"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "theme";

/** Light/dark switch. The theme lives on <html data-theme>; the inline script
 *  in the root layout restores it before first paint, so there is no flash. */
export default function ThemeToggle({ className = "theme" }: { className?: string }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
    try {
      localStorage.setItem(KEY, next ? "light" : "dark");
    } catch {
      /* storage blocked — theme just won't persist */
    }
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={light ? "Switch to dark theme" : "Switch to light theme"} title="Toggle theme">
      {light ? <Moon size={14} strokeWidth={2.2} /> : <Sun size={14} strokeWidth={2.2} />}
    </button>
  );
}
