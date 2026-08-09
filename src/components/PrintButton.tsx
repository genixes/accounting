"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      className="btn ghost no-print"
      style={{ width: "auto", padding: "8px 16px" }}
      onClick={() => window.print()}
    >
      Print / Save as PDF
    </button>
  );
}
