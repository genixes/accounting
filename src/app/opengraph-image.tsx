import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Layaw System";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Logo-only on purpose: the official mark is the brand, and rendering text
// here would mean shipping a fallback font that isn't ours.
export default async function OpengraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public/assets/logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 40%, #04284D 0%, #04101C 70%)",
          position: "relative",
        }}
      >
        {/* Light plate keeps the navy half of the mark legible on the deep background. */}
        <div style={{ display: "flex", background: "#F2F7F9", borderRadius: 48, padding: 64 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} width={300} height={300} alt="" />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 10,
            background: "linear-gradient(90deg, #08DBDE, #085B68)",
          }}
        />
      </div>
    ),
    size
  );
}
