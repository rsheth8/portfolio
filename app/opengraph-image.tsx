import { ImageResponse } from "next/og";
import { profile } from "@/data/site";

// Social/link-preview card (1200×630). Rendered at build time and served at
// /opengraph-image — also reused as the Twitter card via layout metadata.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${profile.name} — portfolio`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(circle at 30% 20%, #1a1a26 0%, #06060a 60%)",
          color: "#ece2c6",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#6a6a78",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#ff3a7a",
            }}
          />
          00 — Pulse
        </div>
        <div style={{ fontSize: 120, fontWeight: 300, marginTop: 24 }}>
          {profile.name}
        </div>
        <div
          style={{
            fontSize: 34,
            marginTop: 24,
            maxWidth: 900,
            color: "#d6cdb8",
            lineHeight: 1.4,
          }}
        >
          {profile.tagline}
        </div>
      </div>
    ),
    { ...size },
  );
}
