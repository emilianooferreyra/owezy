import { z } from "zod";
import { DEFAULT_LOCALE, format, getDictionary, type Locale } from "../../../core/i18n";
import { formatMoney } from "../../../core/money/money";
import type { ActivityView } from "../charges-feature";
import { currencyOf, timeZoneOf } from "./shops";

const event = {
  transferId: z.string(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.string(),
  receivedAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
};

// The route's answer reaches the browser as `unknown`, so the panel validates it before rendering.
const activitySchema = z.object({
  activity: z.array(
    z.discriminatedUnion("kind", [
      z.object({
        ...event,
        id: z.templateLiteral(["payment-matched:", z.string()]),
        kind: z.literal("payment-matched"),
        chargeId: z.string(),
        customer: z.string(),
      }),
      z.object({ ...event, id: z.templateLiteral(["payment-unmatched:", z.string()]), kind: z.literal("payment-unmatched") }),
      z.object({
        ...event,
        id: z.templateLiteral(["payment-ambiguous:", z.string()]),
        kind: z.literal("payment-ambiguous"),
        chargeIds: z.array(z.string()),
      }),
    ]),
  ),
});

/** Validates the activity route's answer; undefined when it is not one. */
export function parseActivity(body: unknown): readonly ActivityView[] | undefined {
  const parsed = activitySchema.safeParse(body);
  return parsed.success ? parsed.data.activity : undefined;
}

/** A clock in the page's language, set to the time zone of the shop that got paid. */
function clockTime(iso: string, currency: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timeZoneOf(currency),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export type ActivityLine = Readonly<{
  /** When the money arrived, in the shop's local time. */
  time: string;
  text: string;
  /** True when the agent could not decide and the owner has to look at it. */
  needsOwner: boolean;
}>;

/** One entry of the activity log, as the owner reads it: in their language and their currency. */
export function activityLine(entry: ActivityView, locale: Locale = DEFAULT_LOCALE): ActivityLine {
  const copy = getDictionary(locale).activity;
  const time = clockTime(entry.receivedAt, entry.currency, locale);
  const amount = formatMoney(entry.amount, currencyOf(entry.currency));
  switch (entry.kind) {
    case "payment-matched":
      return { time, text: format(copy.matched, { customer: entry.customer, chargeId: entry.chargeId, amount }), needsOwner: false };
    case "payment-unmatched":
      return { time, text: format(copy.unmatched, { amount }), needsOwner: true };
    case "payment-ambiguous":
      return {
        time,
        text: format(copy.ambiguous, { amount, chargeIds: entry.chargeIds.join(copy.or) }),
        needsOwner: true,
      };
  }
}

/** When the agent recorded its newest entry: what the owner has seen once they open the activity. */
export function newestRecordedAt(activity: readonly ActivityView[]): string | undefined {
  return activity.reduce<string | undefined>((newest, { recordedAt }) => (newest && newest >= recordedAt ? newest : recordedAt), undefined);
}

/** How many entries the agent recorded after `seenAt` (ISO timestamps compare as text). */
export function unreadCount(activity: readonly ActivityView[], seenAt: string | undefined): number {
  return activity.filter(({ recordedAt }) => seenAt === undefined || recordedAt > seenAt).length;
}
