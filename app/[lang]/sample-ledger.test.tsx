// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => motion.reduced,
}));

import { I18nProvider } from "@/core/i18n/i18n-provider";
import { SampleLedger } from "./sample-ledger";

const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;
const total = () => (screen.getByRole("region", { name: "Libreta" }).querySelector("header") as HTMLElement).textContent;
const later = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  motion.reduced = false;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderSample = () =>
  render(
    <I18nProvider locale="es-AR">
      <SampleLedger />
    </I18nProvider>,
  );

describe("SampleLedger", () => {
  it("lets the visitor look first: nothing changes during the first seconds", () => {
    renderSample();

    later(3_500);

    expect(within(row("Juan Pérez")).queryByText("Link enviado")).toBeNull();
    expect(total()).toContain("$94.000");
  });

  it("tells the story once on its own: Juan gets the link and pays, then Carlos, and the total goes down", () => {
    renderSample();
    expect(within(row("Juan Pérez")).getByText("Cobrar")).toBeTruthy();
    expect(within(row("Carlos Ruiz")).getByText("Cobrar")).toBeTruthy();
    expect(screen.queryByText(/te pagó/)).toBeNull();
    expect(total()).toContain("$94.000");

    later(4_000);
    expect(within(row("Juan Pérez")).getByText("Link enviado")).toBeTruthy();

    later(2_500);
    expect(within(row("Juan Pérez")).getByText("Al día")).toBeTruthy();
    expect(screen.getByText("💸 Juan Pérez te pagó $57.000")).toBeTruthy();
    expect(total()).toContain("$37.000");

    later(1_700);
    expect(within(row("Carlos Ruiz")).getByText("Link enviado")).toBeTruthy();

    later(2_500);
    expect(within(row("Carlos Ruiz")).getByText("Al día")).toBeTruthy();
    expect(screen.getByText("💸 Carlos Ruiz te pagó $28.000")).toBeTruthy();
    expect(total()).toContain("$9.000");
  });

  it("sends Martina her link without her paying: she still owes $9.000", () => {
    renderSample();
    expect(within(row("Martina Gómez")).getByText("Cobrar")).toBeTruthy();
    expect(within(row("Martina Gómez")).getByText("$9.000")).toBeTruthy();

    later(11_500);

    expect(within(row("Martina Gómez")).getByText("Link enviado")).toBeTruthy();
    expect(within(row("Martina Gómez")).getByText("$9.000")).toBeTruthy();
    expect(screen.queryByText(/Martina Gómez te pagó/)).toBeNull();
    expect(screen.getByText("📨 Link enviado a Martina Gómez")).toBeTruthy();
  });

  it("ends by writing Lucía down: a new row to charge, and the total goes up", () => {
    renderSample();
    expect(screen.queryByText("Lucía Fernández")).toBeNull();

    later(13_000);
    expect(row("Lucía Fernández").className).toContain("bg-highlight/50");

    later(3_000);

    expect(row("Lucía Fernández").className).not.toContain("bg-highlight/50");
    expect(within(row("Lucía Fernández")).getByText("Cobrar")).toBeTruthy();
    expect(within(row("Lucía Fernández")).getByText("$7.500")).toBeTruthy();
    expect(total()).toContain("$16.500");
    expect(screen.getByText("📝 Anotado: Lucía Fernández · $7.500")).toBeTruthy();
  });

  it("plays only once: nothing changes after the story ends", () => {
    renderSample();
    later(16_000);
    const after = total();

    later(20_000);

    expect(total()).toBe(after);
    expect(screen.getByText("📝 Anotado: Lucía Fernández · $7.500")).toBeTruthy();
  });

  it("stays still for people who asked the system to reduce motion, with a payment note shown", () => {
    motion.reduced = true;
    renderSample();

    later(20_000);

    expect(within(row("Juan Pérez")).getByText("Cobrar")).toBeTruthy();
    expect(screen.getByText(/te pagó/)).toBeTruthy();
    expect(total()).toContain("$94.000");
  });
});
