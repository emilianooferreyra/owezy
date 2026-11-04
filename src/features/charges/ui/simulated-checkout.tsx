"use client";

import { LoaderCircle, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/core/ui/card";
import type { ChargeView } from "../charges-feature";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { chargeAmount, parseChargeView, receiptFor } from "./charge-card-model";
import { ReceiptView } from "./receipt-view";
import { shopOfCurrency } from "./shops";

type State = "idle" | "paying" | "ambiguous" | "error";

/**
 * The payer's checkout for a simulated charge. Inside the demo phone, `onPaid` hands the paid
 * charge to the page; on its own page it shows the receipt in place. The copy follows the page's
 * language; the amount and how the payer pays follow the charge's currency.
 */
export function SimulatedCheckout({
  charge: initial,
  onPaid,
}: {
  charge: ChargeView;
  onPaid?: (charge: ChargeView) => void;
}) {
  const [charge, setCharge] = useState(initial);
  const [state, setState] = useState<State>("idle");
  const { locale, dict } = useI18n();
  const copy = dict.checkout;
  const receipt = receiptFor(charge, locale);

  async function pay() {
    setState("paying");
    try {
      const response = await fetch(`/api/charges/${encodeURIComponent(charge.id)}/simulate-payment`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as { charge: unknown; outcome: string };
      const latest = parseChargeView(body.charge);
      if (!latest) {
        throw new Error("Unexpected response");
      }
      setCharge(latest);
      if (latest.status === "paid") {
        setState("idle");
        onPaid?.(latest);
      } else {
        setState(body.outcome === "ambiguous" ? "ambiguous" : "error");
      }
    } catch {
      setState("error");
    }
  }

  if (receipt && !onPaid) {
    return (
      <Card>
        <CardContent>
          <ReceiptView receipt={receipt} />
        </CardContent>
      </Card>
    );
  }

  const message = state === "ambiguous" ? copy.ambiguous : state === "error" ? copy.error : undefined;
  const payLabel = format(copy.pay, { amount: chargeAmount(charge) });

  return (
    <Card className="text-center">
      <CardHeader className="justify-items-center">
        <CardDescription>
          {copy.charge} <span className="font-mono">{charge.id}</span> · {charge.customer}
        </CardDescription>
        <CardTitle>{charge.description}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-4xl font-semibold tracking-tight">{chargeAmount(charge)}</p>
        <p className="text-muted-foreground">{copy.howYouPay[shopOfCurrency(charge.currency).country]}</p>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button
          size="lg"
          className="w-full"
          onClick={pay}
          disabled={state === "paying" || charge.status === "paid"}
        >
          {state === "paying" ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" /> {copy.processing}
            </>
          ) : (
            <>
              <Lock aria-hidden="true" /> {payLabel}
            </>
          )}
        </Button>
        {message && (
          <p role="status" className={state === "error" ? "text-destructive" : "text-test-foreground"}>
            {message}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
