"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { format } from "@/core/i18n";
import { useI18n } from "@/core/i18n/i18n-provider";
import { type Currency, formatMoney } from "@/core/money/money";
import type { LedgerView } from "@/features/charges/charges-feature";
import { LedgerCard } from "@/features/charges/ui";

type Status = "unbilled" | "charged" | "paid";

const entry = (currency: Currency) => (id: string, customer: string, description: string, amount: string, status: Status) => ({
  id,
  customer,
  description,
  amount,
  currency,
  recordedAt: "2026-11-03T15:00:00.000Z",
  status,
});

const ars = entry("wARS");
const brl = entry("wBRL");

// Fixed data, the same shops the demo starts with: the landing never reads the database.
const ARGENTINE_SAMPLE: LedgerView = {
  customers: [
    {
      customer: "Juan Pérez",
      owed: "57000",
      unbilled: "57000",
      entries: [
        ars("L-0001", "Juan Pérez", "medialunas", "12000", "unbilled"),
        ars("L-0003", "Juan Pérez", "torta", "45000", "unbilled"),
      ],
    },
    {
      customer: "Carlos Ruiz",
      owed: "28000",
      unbilled: "28000",
      entries: [ars("L-0004", "Carlos Ruiz", "alfajores", "28000", "unbilled")],
    },
    {
      customer: "Martina Gómez",
      owed: "9000",
      unbilled: "9000",
      entries: [ars("L-0002", "Martina Gómez", "pan", "9000", "unbilled")],
    },
    {
      customer: "Lucía Fernández",
      owed: "7500",
      unbilled: "7500",
      entries: [ars("L-0005", "Lucía Fernández", "budín de limón", "7500", "unbilled")],
    },
  ],
  totalOwed: "94000",
};

// Bia's bakery in São Paulo, matching the Portuguese hero scene (João owes R$ 570).
const BRAZILIAN_SAMPLE: LedgerView = {
  customers: [
    {
      customer: "João Silva",
      owed: "570",
      unbilled: "570",
      entries: [
        brl("L-0001", "João Silva", "pão de queijo", "120", "unbilled"),
        brl("L-0003", "João Silva", "bolo de aniversário", "450", "unbilled"),
      ],
    },
    {
      customer: "Pedro Santos",
      owed: "280",
      unbilled: "280",
      entries: [brl("L-0004", "Pedro Santos", "brigadeiros", "280", "unbilled")],
    },
    {
      customer: "Ana Costa",
      owed: "90",
      unbilled: "90",
      entries: [brl("L-0002", "Ana Costa", "pão francês", "90", "unbilled")],
    },
    {
      customer: "Beatriz Lima",
      owed: "75",
      unbilled: "75",
      entries: [brl("L-0005", "Beatriz Lima", "bolo de fubá", "75", "unbilled")],
    },
  ],
  totalOwed: "940",
};

// The story, one customer after the other: Juan and Carlos get the payment link and pay; Martina
// gets hers and still owes; then Lucía is written down, the step that starts it all over. Times are
// ms after the card appears: the rows are written down first, then the visitor gets two seconds to
// look before anything moves.
const LOOK_FIRST = 2_000;
const STORY: readonly { linkAt: number; paidAt?: number }[] = [
  { linkAt: LOOK_FIRST + 1_800, paidAt: LOOK_FIRST + 3_600 },
  { linkAt: LOOK_FIRST + 5_400, paidAt: LOOK_FIRST + 7_200 },
  { linkAt: LOOK_FIRST + 9_000 },
];
const WRITTEN_DOWN_AT = LOOK_FIRST + 10_800;
const FRESH_FOR = 1_800;
const COUNT_MS = 900;
const COUNT_STEPS = 18;

type Beat = "owes" | "link-sent" | "paid";

/**
 * The sample at a moment of the story: the first customers at their beat, the last one (Lucía)
 * only once written down, and the total that is counting.
 */
function sampleAt(sample: LedgerView, beats: readonly Beat[], writtenDown: boolean, total: number): LedgerView {
  const customers = writtenDown ? sample.customers : sample.customers.slice(0, -1);
  return {
    totalOwed: String(total),
    customers: customers.map((customer, index) => {
      const beat = beats[index] ?? "owes";
      if (beat === "owes") return customer;
      const status: Status = beat === "paid" ? "paid" : "charged";
      return {
        ...customer,
        unbilled: "0",
        owed: beat === "paid" ? "0" : customer.owed,
        entries: customer.entries.map((entry) => ({ ...entry, status })),
      };
    }),
  };
}

/**
 * The ledger card with sample data: Brazilian customers in reais for a Portuguese visitor, Argentine
 * ones in pesos otherwise. It is a picture that tells the product's story once, on its own: the rows
 * get written down, then Juan and Carlos each get the payment link and pay, and the total goes down.
 * Its Cobrar does nothing: the demo button is the way in. Nothing moves when the system asks to
 * reduce motion.
 */
export function SampleLedger() {
  const { locale, dict } = useI18n();
  const brazilian = locale === "pt-BR";
  const sample = brazilian ? BRAZILIAN_SAMPLE : ARGENTINE_SAMPLE;
  const currency: Currency = brazilian ? "wBRL" : "wARS";
  const reduced = useReducedMotion() ?? false;
  const start = Number(sample.totalOwed);

  const [beats, setBeats] = useState<readonly Beat[]>([]);
  const [total, setTotal] = useState(start);
  // The yellow note tells the latest step: who paid, who got a link, who was written down.
  const [note, setNote] = useState<{ kind: "paid" | "sent" | "written"; index: number } | undefined>(undefined);
  const [writtenDown, setWrittenDown] = useState(false);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    /** The total moves to `to`, a few steps at a time, starting at `at`. */
    const count = (from: number, to: number, at: number) => {
      for (let step = 1; step <= COUNT_STEPS; step += 1) {
        timers.push(
          setTimeout(() => setTotal(Math.round(from + ((to - from) * step) / COUNT_STEPS)), at + (COUNT_MS * step) / COUNT_STEPS),
        );
      }
    };
    let owed = start;
    STORY.forEach(({ linkAt, paidAt }, index) => {
      const at = (beat: Beat) => (current: readonly Beat[]) => Object.assign([...current], { [index]: beat });
      timers.push(
        setTimeout(() => {
          setBeats(at("link-sent"));
          // A link that ends the story gets its own note; the others are told by the payment.
          if (paidAt === undefined) setNote({ kind: "sent", index });
        }, linkAt),
      );
      if (paidAt === undefined) return;
      const amount = Number(sample.customers[index]?.owed ?? 0);
      const from = owed;
      owed -= amount;
      const to = owed;
      timers.push(
        setTimeout(() => {
          setBeats(at("paid"));
          setNote({ kind: "paid", index });
        }, paidAt),
      );
      count(from, to, paidAt);
    });
    // Lucía is written down: a fresh row, and the total goes up by what she took.
    const late = Number(sample.customers.at(-1)?.owed ?? 0);
    timers.push(
      setTimeout(() => {
        setWrittenDown(true);
        setFresh(true);
        setNote({ kind: "written", index: sample.customers.length - 1 });
      }, WRITTEN_DOWN_AT),
    );
    timers.push(setTimeout(() => setFresh(false), WRITTEN_DOWN_AT + FRESH_FOR));
    count(owed, owed + late, WRITTEN_DOWN_AT);
    return () => timers.forEach(clearTimeout);
  }, [reduced, start, sample]);

  const TEMPLATES = { paid: dict.landing.scenePaid, sent: dict.landing.sceneSent, written: dict.landing.sceneWritten };
  const noteFor = ({ kind, index }: { kind: keyof typeof TEMPLATES; index: number }) => {
    const customer = sample.customers[index];
    return customer
      ? format(TEMPLATES[kind], { customer: customer.customer, amount: formatMoney(customer.owed, currency) })
      : "";
  };
  const NOTE =
    "absolute -right-3 -bottom-5 inline-flex rotate-2 items-center gap-2 rounded-2xl bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-lg";

  return (
    <>
      <LedgerCard
        ledger={sampleAt(sample, beats, writtenDown, total)}
        currency={currency}
        stagger={!reduced}
        fresh={fresh ? sample.customers.at(-1)?.customer : undefined}
      />
      {reduced ? (
        <p aria-hidden="true" className={NOTE}>
          {noteFor({ kind: "paid", index: 0 })}
        </p>
      ) : (
        <AnimatePresence mode="popLayout">
          {note !== undefined && (
            <motion.p
              key={`${note.kind}-${note.index}`}
              aria-hidden="true"
              className={NOTE}
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {noteFor(note)}
            </motion.p>
          )}
        </AnimatePresence>
      )}
    </>
  );
}
