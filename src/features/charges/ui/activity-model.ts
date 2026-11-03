import { z } from "zod";
import { formatArs } from "../../../core/money/money";
import type { ActivityView } from "../charges-feature";

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

const ARGENTINA_CLOCK = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type ActivityLine = Readonly<{
  /** When the money arrived, in Argentine time. */
  time: string;
  text: string;
  /** True when the agent could not decide and the owner has to look at it. */
  needsOwner: boolean;
}>;

/** One entry of the activity log, as the owner reads it. */
export function activityLine(entry: ActivityView): ActivityLine {
  const time = ARGENTINA_CLOCK.format(new Date(entry.receivedAt));
  const amount = formatArs(entry.amount);
  switch (entry.kind) {
    case "payment-matched":
      return { time, text: `${entry.customer} pagó el cobro ${entry.chargeId} (${amount})`, needsOwner: false };
    case "payment-unmatched":
      return { time, text: `Llegó un pago de ${amount} que no coincide con ningún cobro`, needsOwner: true };
    case "payment-ambiguous":
      return {
        time,
        text: `Llegó un pago de ${amount} que puede ser de ${entry.chargeIds.join(" o ")}: elegí vos cuál`,
        needsOwner: true,
      };
  }
}
