import { ImageResponse } from "next/og";

// Generated favicon — a hot-magenta pulse dot on near-black, matching the
// site's "bass kick" accent. Next.js serves this at /icon.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#06060a",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#ff3a7a",
            boxShadow: "0 0 8px #ff3a7a",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
