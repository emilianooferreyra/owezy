import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE, getDictionary, hasLocale } from "@/core/i18n";

// The preview a shared link shows. It depends on no request data, so Next.js renders it once at
// build time and caches it. Satori supports flexbox only, and the default font keeps it light.
export const alt = "Owezy. They owe, you get paid. Collections in pesos and reais on Celo and Ripio.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { landing } = getDictionary(hasLocale(lang) ? lang : DEFAULT_LOCALE);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 28,
        padding: 96,
        background: "#ffffff",
        color: "#171717",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, color: "#476520" }}>{landing.badge}</div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1.05 }}>
        <span>Owezy</span>
        <span style={{ color: "#476520", fontSize: 60 }}>{landing.tagline}</span>
      </div>
      <div style={{ display: "flex", fontSize: 34, color: "#3f3f50" }}>
        {landing.builtWith}
      </div>
    </div>,
    size,
  );
}
