export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif", color: "#101634" }}>
      <div style={{ textAlign: "center" }}>
        <h1>Construction Accounting</h1>
        <p>This is a multi-tenant ledger. Each company has its own workspace at <code>/t/&lt;company-slug&gt;</code>.</p>
      </div>
    </div>
  );
}
