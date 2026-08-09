export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at 20% 15%, rgba(34,211,238,.08), transparent 45%)," +
          "radial-gradient(circle at 85% 85%, rgba(59,130,246,.08), transparent 45%), #0A101F",
        color: "#F4F6FB",
        fontFamily: "'IBM Plex Sans', -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ background: "#fff", padding: 12, borderRadius: 16, display: "inline-block", margin: "0 auto 20px", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="Layaw System" width={56} height={56} style={{ display: "block" }} />
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', Impact, sans-serif", fontWeight: 700, fontSize: 34, textTransform: "uppercase", letterSpacing: ".04em" }}>
          Layaw System
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', Impact, sans-serif", fontSize: 12, letterSpacing: ".28em", color: "#5B9EEF", textTransform: "uppercase", marginTop: 6 }}>
          Simple &middot; Smart &middot; Solid
        </div>
        <p style={{ color: "#9AA6C3", fontSize: 14.5, lineHeight: 1.6, marginTop: 20 }}>
          Multi-tenant construction accounting. Each client gets their own branded,
          isolated workspace at <code style={{ color: "#F4F6FB" }}>/t/&lt;company-slug&gt;</code>.
        </p>
      </div>
    </div>
  );
}
