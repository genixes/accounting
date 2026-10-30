export default function Flash({ err, ok }: { err?: string; ok?: string }) {
  if (!err && !ok) return null;
  return (
    <div className="sheet" style={{ marginBottom: 16, borderColor: err ? "var(--out)" : "var(--in)" }}>
      <div className="bd" style={{ padding: "12px 18px", color: err ? "var(--out)" : "var(--in)" }}>{err || ok}</div>
    </div>
  );
}
