"use client";

import { BadgeCheck } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { DEFAULT_CURRENCY, formatMoney, isCurrency } from "../../../core/money/money";
import type { ActivityView } from "../charges-feature";
import { EMPTY_NOTICES, type PaymentNotice, trackPaymentNotices } from "./payment-notices";

/**
 * The payments that arrived while the chat is open, from the same activity read as the bell.
 * Each one keeps the place in the conversation where it arrived.
 */
export function usePaymentNotices(
  activity: readonly ActivityView[] | undefined,
  messageCount: number,
): readonly PaymentNotice[] {
  const [state, setState] = useState(EMPTY_NOTICES);
  // Read when the activity changes, without re-running on every streamed message.
  const messages = useRef(messageCount);
  messages.current = messageCount;
  useEffect(() => setState((current) => trackPaymentNotices(current, activity, messages.current)), [activity]);
  return state.notices;
}

/** The notices that go right after the chat's `afterMessage`-th message (0: before the first). */
export function PaymentNotices({ notices, afterMessage }: { notices: readonly PaymentNotice[]; afterMessage: number }) {
  const copy = useI18n().dict.demo;
  return notices
    .filter((notice) => notice.afterMessage === afterMessage)
    .map((notice) => (
      <motion.p
        key={notice.id}
        role="status"
        aria-label={copy.paymentArrivedLabel}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 self-center rounded-full bg-success/15 px-4 py-2 text-sm text-success"
      >
        <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
        {format(copy.paymentArrived, {
          customer: notice.customer,
          amount: formatMoney(notice.amount, isCurrency(notice.currency) ? notice.currency : DEFAULT_CURRENCY),
          charge: notice.chargeId,
        })}
      </motion.p>
    ));
}
