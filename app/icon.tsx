import { ImageResponse } from "next/og";
import { OwezyMark } from "@/core/ui/owezy-mark";

// The browser tab icon, rendered from the same vector mark as the header, so it is sharp at any size.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<OwezyMark size={64} />, size);
}
