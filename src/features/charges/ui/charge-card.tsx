"use client";

import { Check, Copy, MessageCircle, ReceiptText, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useEffect, useId, useState } from "react";
import { cn } from "@/core/lib/utils";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/core/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/core/ui/dialog";
import { Input } from "@/core/ui/input";
import type { ChargeView } from "../charges-feature";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { chargeAmount, receiptFor, whatsAppNumber, whatsAppShareUrl } from "./charge-card-model";
import { useDemo } from "./demo-context";
import { ReceiptView } from "./receipt-view";
import { shopOfCurrency } from "./shops";

/**
 * The card's charge, kept current by the demo's shared status poll while it is pending, so a
 * payment made elsewhere (the /pay page on another device) also reaches the card. The charge
 * joins the shared state when the owner sends it (an event), not when the card renders: two
 * cards of the same charge would otherwise overwrite each other's view after every render.
 */
function useChargeSync(initial: ChargeView) {
  const { state, dispatch, watch } = useDemo();
  const charge = state.charges[initial.id] ?? initial;

  useEffect(() => {
    if (charge.status === "paid") {
      return;
    }
    return watch(charge.id);
  }, [charge.id, charge.status, watch]);

  return { charge, sent: state.sent.includes(charge.id), dispatch };
}

function StatusBadge({ status }: { status: ChargeView["status"] }) {
  const copy = useI18n().dict.charges;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
        className="inline-flex"
      >
        <Badge
          role="status"
          className={status === "paid" ? "bg-success/15 text-success" : "bg-test-muted text-test-foreground"}
        >
          {status === "paid" && <Check aria-hidden="true" />}
          {status === "paid" ? copy.paid : copy.pending}
        </Badge>
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * The customer's contact, asked right in the card. The mobile number only builds the WhatsApp
 * link: it is not saved anywhere. It is read the way the charge's country writes it.
 */
function ContactForm({
  charge,
  onSend,
  onCancel,
}: {
  charge: ChargeView;
  onSend: (whatsAppUrl: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const { locale, dict } = useI18n();
  const copy = dict.charges;
  const { country } = shopOfCurrency(charge.currency);
  const [first = charge.customer, ...rest] = charge.customer.trim().split(/\s+/);
  const [invalidPhone, setInvalidPhone] = useState(false);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const phone = whatsAppNumber(String(data.get("phone") ?? ""), country);
    if (!phone) {
      setInvalidPhone(true);
      return;
    }
    const firstName = String(data.get("firstName") ?? "").trim() || first;
    onSend(whatsAppShareUrl(charge, { firstName, phone }, locale));
  }

  return (
    <form aria-label={format(copy.contactLabel, { name: first })} noValidate onSubmit={send} className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <label htmlFor={`${id}-first`} className="text-xs font-medium text-muted-foreground">
            {copy.firstName}
          </label>
          <Input id={`${id}-first`} name="firstName" defaultValue={first} autoComplete="off" />
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-last`} className="text-xs font-medium text-muted-foreground">
            {copy.lastName}
          </label>
          <Input id={`${id}-last`} name="lastName" defaultValue={rest.join(" ")} autoComplete="off" />
        </div>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-phone`} className="text-xs font-medium text-muted-foreground">
          {copy.phone}
        </label>
        <Input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder={copy.phonePlaceholder[country]}
          autoComplete="off"
          aria-invalid={invalidPhone}
          aria-describedby={`${id}-phone-hint`}
          onChange={() => setInvalidPhone(false)}
        />
        <p id={`${id}-phone-hint`} role={invalidPhone ? "alert" : undefined} className={cn("text-xs", invalidPhone ? "text-destructive" : "text-muted-foreground")}>
          {invalidPhone ? copy.phoneInvalid[country] : copy.phoneHint[country]}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="cursor-pointer">
          <Send aria-hidden="true" /> {copy.sendWhatsApp}
        </Button>
        <Button type="button" variant="ghost" className="cursor-pointer" onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </form>
  );
}

export function ChargeCard({ charge: initial }: { charge: ChargeView }) {
  const { charge, sent, dispatch } = useChargeSync(initial);
  const { locale, dict } = useI18n();
  const copy = dict.charges;
  const [copied, setCopied] = useState(false);
  const [askingContact, setAskingContact] = useState(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string>();
  const receipt = receiptFor(charge, locale);
  const firstName = charge.customer.split(/\s+/)[0] ?? charge.customer;

  async function copyLink() {
    await navigator.clipboard.writeText(charge.paymentLink);
    setCopied(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full max-w-sm"
    >
      <Card
        size="sm"
        aria-label={format(copy.cardLabel, { id: charge.id })}
        className={cn("transition-shadow duration-500", receipt && "ring-success/40")}
      >
        <CardHeader>
          <CardDescription>
            <span className="font-mono">{charge.id}</span> · {charge.customer}
          </CardDescription>
          <CardTitle>{charge.description}</CardTitle>
          <CardAction>
            <StatusBadge status={charge.status} />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-3xl font-semibold tracking-tight">{chargeAmount(charge)}</p>
          {askingContact && !receipt && (
            <ContactForm
              charge={charge}
              onCancel={() => setAskingContact(false)}
              onSend={(url) => {
                setWhatsAppUrl(url);
                setAskingContact(false);
                // The demo's customer phone gets it too, so the flow goes on without a real number.
                dispatch({ type: "charge-sent", charge });
              }}
            />
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          {receipt ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <ReceiptText aria-hidden="true" /> {copy.viewReceipt}
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined}>
                <DialogTitle className="sr-only">{format(copy.receiptTitle, { id: charge.id })}</DialogTitle>
                <ReceiptView receipt={receipt} />
              </DialogContent>
            </Dialog>
          ) : (
            <>
              {!askingContact && (
                <Button
                  disabled={sent}
                  variant={sent ? "secondary" : "default"}
                  className="cursor-pointer"
                  onClick={() => setAskingContact(true)}
                >
                  {sent ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {format(sent ? copy.sentTo : copy.sendTo, { name: firstName })}
                </Button>
              )}
              {sent && whatsAppUrl && (
                <Button asChild variant="outline">
                  <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden="true" /> {copy.openWhatsApp}
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? copy.copied : copy.copyLink}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
