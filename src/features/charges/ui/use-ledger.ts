"use client";

import { useEffect, useState } from "react";
import type { LedgerView } from "../charges-feature";
import { parseLedgerView } from "./ledger-model";

export type LedgerState = Readonly<{ kind: "loading" }> | Readonly<{ kind: "ready"; ledger: LedgerView }> | Readonly<{ kind: "failed" }>;

/**
 * The shop's ledger from the ledger route. A new `version` reads it again, so the greeting stays
 * current after the agent writes something down or charges someone.
 */
export function useLedger(version: number): LedgerState {
  const [state, setState] = useState<LedgerState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/ledger", { cache: "no-store", signal: controller.signal });
        const ledger = response.ok ? parseLedgerView(await response.json()) : undefined;
        if (!controller.signal.aborted) {
          setState((previous) => (ledger ? { kind: "ready", ledger } : previous.kind === "ready" ? previous : { kind: "failed" }));
        }
      } catch {
        // Offline or aborted: keep what is on screen.
        if (!controller.signal.aborted) {
          setState((previous) => (previous.kind === "ready" ? previous : { kind: "failed" }));
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [version]);

  return state;
}
