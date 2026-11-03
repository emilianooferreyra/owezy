import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { cn } from "@/core/lib/utils";
import "./globals.css";

// DM Sans comes from the shadcn preset; Geist Mono is for references and operation numbers.
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { template: "%s · Owezy", default: "Owezy" },
  description: "Asistente de cobros en pesos para PyMEs, sobre Celo y Ripio.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={cn(dmSans.variable, geistMono.variable, "font-sans")}>
      <body>{children}</body>
    </html>
  );
}
