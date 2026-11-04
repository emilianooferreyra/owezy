"use client"; // Error boundaries must be Client Components.

import { RotateCw } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/core/i18n/i18n-provider";
import { Button } from "@/core/ui/button";

/**
 * Catches unexpected errors in any page below the root layout. The technical message is only
 * logged: in production Next.js replaces server error messages with a digest anyway.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { dict } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[80dvh] place-items-center p-4">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{dict.error.title}</h1>
        <p className="text-muted-foreground">{dict.error.body}</p>
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden="true" /> {dict.error.retry}
        </Button>
      </div>
    </main>
  );
}
