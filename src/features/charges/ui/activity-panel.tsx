"use client";

import { Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/core/lib/utils";
import { Badge } from "@/core/ui/badge";
import { useI18n } from "@/core/i18n/i18n-provider";
import { type Currency, DEFAULT_CURRENCY } from "../../../core/money/money";
import type { ActivityView } from "../charges-feature";
import { activityLine, parseActivity } from "./activity-model";

export const ACTIVITY_POLL_INTERVAL_MS = 5000;

/**
 * Keeps the agent's activity log current. The route only reads the log, so polling it is cheap.
 * A failed poll keeps the last list: the next one tries again. Only the shop's `currency` is read.
 */
function useActivity(currency: Currency): readonly ActivityView[] | undefined {
  const [activity, setActivity] = useState<readonly ActivityView[]>();

  useEffect(() => {
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/activity?currency=${currency}`, { cache: "no-store", signal: controller.signal });
        const parsed = response.ok ? parseActivity(await response.json()) : undefined;
        if (parsed && !controller.signal.aborted) {
          setActivity(parsed);
        }
      } catch {
        // Offline or aborted: keep what is on screen.
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), ACTIVITY_POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [currency]);

  return activity;
}

/** What the agent reconciled on its own, newest first, so the owner sees it without asking. */
export function ActivityPanel({ className, currency = DEFAULT_CURRENCY }: { className?: string; currency?: Currency }) {
  const activity = useActivity(currency);
  const { locale, dict } = useI18n();
  const copy = dict.activity;

  return (
    <section
      aria-labelledby="activity-title"
      className={cn("grid gap-2 rounded-3xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/5", className)}
    >
      <h2 id="activity-title" className="inline-flex items-center gap-2 text-sm font-semibold">
        <Bot className="size-4" aria-hidden="true" /> {copy.title}
      </h2>
      {activity === undefined ? (
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      ) : activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul aria-label={copy.list} className="grid max-h-48 gap-2 overflow-y-auto text-sm">
          {activity.map((entry) => {
            const line = activityLine(entry, locale);
            return (
              <li key={entry.id} className="flex items-baseline gap-2">
                <time dateTime={entry.receivedAt} className="shrink-0 tabular-nums text-muted-foreground">
                  {line.time}
                </time>
                <span className="min-w-0 flex-1">{line.text}</span>
                {line.needsOwner && <Badge variant="destructive">{copy.review}</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
