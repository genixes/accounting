import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Layaw System — Construction Accounting",
  description: "Simple. Smart. Solid. Multi-tenant construction accounting, one system per client.",
  icons: { icon: "/assets/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Landing page only: hide reveal start-states before hydration (unless reduced motion). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(location.pathname==='/'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('lp-pre')",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
