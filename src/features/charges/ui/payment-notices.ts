import type { ActivityView } from "../charges-feature";

/** A payment that arrived while the owner had the chat open, shown in the conversation. */
export type PaymentNotice = Readonly<{
  id: string;
  customer: string;
  chargeId: string;
  amount: string;
  currency: string;
  /** How many chat messages there were when it arrived: the notice goes right after them. */
  afterMessage: number;
}>;

export type NoticeState = Readonly<{
  /** Activity already accounted for; undefined until the first read of the activity. */
  known?: ReadonlySet<string>;
  notices: readonly PaymentNotice[];
}>;

export const EMPTY_NOTICES: NoticeState = { notices: [] };

/**
 * Turns the activity feed (the one behind the bell) into chat notices. What the first read finds
 * is history and stays in the bell; every payment that paid a charge after that is announced once,
 * placed after the messages the chat had when it arrived. Comparing ids, not clocks, keeps a
 * server and a browser whose clocks disagree from hiding or repeating a notice.
 */
export function trackPaymentNotices(
  state: NoticeState,
  activity: readonly ActivityView[] | undefined,
  messageCount: number,
): NoticeState {
  if (activity === undefined) return state;
  if (state.known === undefined) return { known: new Set(activity.map(({ id }) => id)), notices: state.notices };

  const known = state.known;
  const arrived = activity
    .filter((entry) => !known.has(entry.id))
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  if (arrived.length === 0) return state;

  const notices = arrived.flatMap((entry): PaymentNotice[] =>
    entry.kind === "payment-matched"
      ? [
          {
            id: entry.id,
            customer: entry.customer,
            chargeId: entry.chargeId,
            amount: entry.amount,
            currency: entry.currency,
            afterMessage: messageCount,
          },
        ]
      : [],
  );
  return { known: new Set([...known, ...arrived.map(({ id }) => id)]), notices: [...state.notices, ...notices] };
}
