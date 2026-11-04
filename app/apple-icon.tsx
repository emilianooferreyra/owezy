import { ImageResponse } from "next/og";
import { OwezyMark } from "@/core/ui/owezy-mark";

// The iPhone home-screen icon. iOS paints transparency black, so the mark sits on the page's warm white.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fbfbf6" }}>
      <OwezyMark size={150} />
    </div>,
    size,
  );
}
