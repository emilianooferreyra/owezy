"use client";

import { ChevronLeft, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/core/ui/button";
import { Card, CardContent } from "@/core/ui/card";
import type { ChargeView } from "../charges-feature";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { chargeAmount, paymentMessage, receiptFor } from "./charge-card-model";
import { useDemo } from "./demo-context";
import { ReceiptView } from "./receipt-view";
import { SimulatedCheckout } from "./simulated-checkout";

const SCREEN_TRANSITION = { type: "spring", stiffness: 420, damping: 38 } as const;

/** The customer's side of the demo: the messages they get, the checkout and the receipt. */
export function PayerPhone({ businessName }: { businessName: string }) {
  const { state, dispatch } = useDemo();
  const { locale, dict } = useI18n();
  const sent = state.sent.flatMap((id) => {
    const charge = state.charges[id];
    return charge ? [charge] : [];
  });
  const current = state.phone.screen === "inbox" ? undefined : state.charges[state.phone.chargeId];
  const receipt = state.phone.screen === "receipt" && current ? receiptFor(current, locale) : undefined;
  const screenKey = state.phone.screen === "inbox" ? "inbox" : `${state.phone.screen}-${state.phone.chargeId}`;

  return (
    <div
      aria-label={dict.payer.phoneLabel}
      className="relative mx-auto grid h-[min(42rem,calc(100dvh-9rem))] min-h-[30rem] w-full max-w-[22rem] grid-rows-[auto_1fr] overflow-hidden rounded-[2.75rem] border-[10px] border-phone-frame bg-phone-screen shadow-2xl"
    >
      <div aria-hidden="true" className="absolute left-1/2 top-1.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-phone-frame" />

      <header className="flex min-h-16 items-end gap-2 bg-phone-bar px-4 pb-3 pt-8 text-phone-bar-foreground">
        {state.phone.screen !== "inbox" ? (
          <button
            type="button"
            onClick={() => dispatch({ type: "phone-back" })}
            className="inline-flex items-center gap-0.5 text-sm font-medium"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> {dict.payer.messages}
          </button>
        ) : (
          <>
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-white/20 text-sm font-bold">
              {businessName.charAt(0)}
            </span>
            <span className="font-semibold">{businessName}</span>
          </>
        )}
      </header>

      <div className="overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey}
            initial={{ opacity: 0, x: state.phone.screen === "inbox" ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: state.phone.screen === "inbox" ? 24 : -24 }}
            transition={SCREEN_TRANSITION}
            className="grid content-start gap-3 p-3"
          >
            {state.phone.screen === "inbox" && (
              <Inbox
                charges={sent}
                onPay={(id) => dispatch({ type: "payment-link-opened", chargeId: id })}
                onReceipt={(id) => dispatch({ type: "receipt-opened", chargeId: id })}
              />
            )}
            {state.phone.screen === "checkout" && current && (
              <SimulatedCheckout charge={current} onPaid={(charge) => dispatch({ type: "charge-paid", charge })} />
            )}
            {receipt && (
              <Card>
                <CardContent>
                  <ReceiptView receipt={receipt} />
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Inbox({
  charges,
  onPay,
  onReceipt,
}: {
  charges: readonly ChargeView[];
  onPay: (id: string) => void;
  onReceipt: (id: string) => void;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.payer;
  if (charges.length === 0) {
    return <p className="mx-4 mt-8 text-center text-sm text-muted-foreground">{copy.empty}</p>;
  }

  return (
    <ol className="grid gap-3">
      <AnimatePresence initial={false}>
        {charges.map((charge) => {
          const isPaid = charge.status === "paid";
          return (
            <motion.li
              key={charge.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="grid max-w-[88%] gap-2 rounded-3xl rounded-tl-lg bg-card p-3 shadow-sm"
            >
              <p className="text-sm">{paymentMessage(charge, undefined, locale).replace(charge.paymentLink, "").trimEnd()}</p>
              <Button
                size="sm"
                variant={isPaid ? "secondary" : "default"}
                onClick={() => (isPaid ? onReceipt(charge.id) : onPay(charge.id))}
              >
                {isPaid ? (
                  copy.paidReceipt
                ) : (
                  <>
                    <Lock aria-hidden="true" /> {format(copy.pay, { amount: chargeAmount(charge) })}
                  </>
                )}
              </Button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
