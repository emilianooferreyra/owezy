"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { localePath } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { Button } from "@/core/ui/button";

/** Any address the app does not handle, and any page that calls notFound() without its own UI. */
export default function NotFound() {
  const { locale, dict } = useI18n();

  return (
    <main className="grid min-h-[80dvh] place-items-center p-4">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.notFound.title}</h1>
        <p className="text-muted-foreground">{dict.notFound.body}</p>
        <Button asChild>
          <Link href={localePath(locale)}>
            <ArrowLeft aria-hidden="true" /> {dict.common.backHome}
          </Link>
        </Button>
      </div>
    </main>
  );
}
