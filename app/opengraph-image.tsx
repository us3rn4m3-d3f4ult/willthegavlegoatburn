import { ImageResponse } from "next/og";
import { SITE } from "@/lib/seo";

export const alt = "Will the Gävle goat burn in 2026?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              background: "#ffffff",
              color: "#000000",
              fontSize: 30,
              fontWeight: 700,
              padding: "6px 16px",
              borderRadius: 10,
            }}
          >
            2026
          </div>
          <div style={{ color: "#8b8b93", fontSize: 30 }}>willthegavlegoatburn.com</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#fafafa",
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 900,
            }}
          >
            Will the Gävle goat burn in 2026?
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 36 }}>
            <div
              style={{
                color: "#ff5c2b",
                fontSize: 96,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              62%
            </div>
            <div style={{ color: "#8b8b93", fontSize: 30, paddingBottom: 14 }}>
              chance it burns
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #1c1c21",
            paddingTop: 28,
            color: "#5a5a62",
            fontSize: 26,
          }}
        >
          <div>Trade Yes or No in USDC on Base</div>
          <div>{SITE.shortTitle}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
