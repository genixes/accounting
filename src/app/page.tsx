export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at 20% 15%, rgba(8,219,222,.07), transparent 45%)," +
          "radial-gradient(circle at 85% 85%, rgba(4,40,77,.55), transparent 50%), var(--brand-deep)",
        color: "var(--ink)",
        fontFamily: "var(--body)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Light plate with generous clear space: the navy half of the mark
            would otherwise sink into the deep background. */}
        <div
          style={{
            background: "#F2F7F9",
            padding: 18,
            borderRadius: 20,
            display: "inline-block",
            margin: "0 auto 28px",
            boxShadow: "0 12px 32px rgba(0,0,0,.45)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo.png" alt="Layaw System" width={72} height={72} style={{ display: "block" }} />
        </div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, textTransform: "uppercase", letterSpacing: ".08em" }}>
          Layaw System
        </div>
        <div
          style={{
            fontFamily: "var(--display)",
            fontWeight: 600,
            fontSize: 11.5,
            letterSpacing: ".32em",
            color: "var(--brand-tagline)",
            textTransform: "uppercase",
            marginTop: 10,
          }}
        >
          Simple &middot; Smart &middot; Solid
        </div>
        <div style={{ width: 56, height: 2, margin: "22px auto 0", background: "var(--brand-grad)", borderRadius: 2 }} />
        <p style={{ color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.7, marginTop: 22 }}>
          Multi-tenant construction accounting. Each client gets their own branded,
          isolated workspace at{" "}
          <code style={{ color: "var(--ink)", fontFamily: "var(--data)", fontSize: 13 }}>/t/&lt;company-slug&gt;</code>.
        </p>
      </div>
    </div>
  );
}
