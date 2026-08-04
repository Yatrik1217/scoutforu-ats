import { ImageResponse } from "next/og";

// iOS home-screen icon (Safari uses this, not the manifest). 180×180 PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a6fdb",
          color: "#fff",
          fontSize: 116,
          fontWeight: 800,
          fontFamily: "Arial, sans-serif",
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
