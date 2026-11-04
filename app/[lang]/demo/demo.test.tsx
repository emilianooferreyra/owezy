// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The chat without a running agent: what matters here is what the owner sees and what gets sent.
const agent = vi.hoisted(() => ({
  status: "ready" as string,
  data: { messages: [] as unknown[] },
  error: undefined,
  send: (() => Promise.resolve()) as (message: string) => Promise<void>,
}));
vi.mock("eve/react", () => ({ useEveAgent: () => agent }));
import { DemoScreen } from "./demo";

const LEDGER = {
  customers: [
    {
      customer: "Juan Pérez",
      owed: "57000",
      unbilled: "57000",
      entries: [
        { id: "L-0001", customer: "Juan Pérez", description: "torta", amount: "57000", currency: "wARS", recordedAt: "2026-11-03T15:00:00.000Z", status: "unbilled" },
      ],
    },
  ],
  totalOwed: "57000",
};

/** The demo's routes: the ledger answers with LEDGER (or `ledgerStatus`), the rest with nothing. */
let ledgerStatus = 200;
beforeEach(() => {
  agent.status = "ready";
  agent.send = vi.fn(() => Promise.resolve());
  agent.data.messages = [];
  ledgerStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).startsWith("/api/ledger")
        ? new Response(JSON.stringify(LEDGER), { status: ledgerStatus })
        : new Response(JSON.stringify({ activity: [], charges: [] })),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const chat = () => screen.getByRole("region", { name: "Negocio" });

describe("demo chat", () => {
  it("greets the owner with what the shop is owed today, from the ledger", async () => {
    render(<DemoScreen />);

    const greeting = within(chat()).getByRole("note", { name: "Saludo del asistente" });
    expect(await within(greeting).findByText("¡Hola, Ana! Hoy te deben $57.000 entre 1 cliente.")).toBeTruthy();
    expect(within(greeting).getByRole("region", { name: "Libreta" })).toBeTruthy();
  });

  it("still greets the owner when the ledger cannot be read", async () => {
    ledgerStatus = 503;
    render(<DemoScreen />);

    expect(await within(chat()).findByText(/Contame qué se llevó alguien/)).toBeTruthy();
  });

  it("charges a customer from the greeting's ledger with one tap, as if the owner typed it", async () => {
    render(<DemoScreen />);

    fireEvent.click(await within(chat()).findByRole("button", { name: "Cobrar a Juan Pérez" }));

    expect(agent.send).toHaveBeenCalledWith("Cobrale a Juan Pérez lo que debe", undefined);
  });

  it("offers no scripted suggestions: the owner writes freely, with an example in the box", () => {
    render(<DemoScreen />);

    expect(within(chat()).queryByRole("list", { name: "Sugerencias" })).toBeNull();
    expect(within(chat()).getByPlaceholderText(/Anotá que Juan llevó/)).toBeTruthy();
  });

  it("keeps what the agent reconciled on its own one tap away, in the header", async () => {
    render(<DemoScreen />);

    expect(within(chat()).queryByRole("region", { name: "Lo que hice solo" })).toBeNull();
    fireEvent.click(within(chat()).getByRole("button", { name: /Actividad/ }));

    expect(within(chat()).getByRole("region", { name: "Lo que hice solo" })).toBeTruthy();
  });

  it("answers with cards: the ledger, what was written down, and which customer when a name is ambiguous", () => {
    const tool = (toolCallId: string, toolName: string, output: unknown) => ({
      type: "dynamic-tool",
      toolCallId,
      toolName,
      state: "output-available",
      input: {},
      output,
    });
    agent.data.messages = [
      {
        id: "m1",
        role: "assistant",
        parts: [
          tool("t1", "read_ledger", LEDGER),
          tool("t2", "add_to_ledger", { created: true, entry: { ...LEDGER.customers[0]?.entries[0], id: "L-0002", description: "pastafrola", amount: "8000" } }),
          tool("t3", "charge_from_ledger", { charged: false, reason: "…", candidates: ["Juan Pérez", "Juan Ruiz"] }),
        ],
      },
    ];
    render(<DemoScreen />);

    const answer = within(chat()).getAllByRole("region", { name: "Libreta" });
    expect(answer.length).toBeGreaterThan(0);
    expect(within(chat()).getByRole("status").textContent).toContain("pastafrola");
    fireEvent.click(within(within(chat()).getByRole("group", { name: "¿Cuál cliente?" })).getByRole("button", { name: /Juan Ruiz/ }));
    expect(agent.send).toHaveBeenCalledWith("Juan Ruiz", undefined);
  });

  it("shows the agent's **bold** as bold, not as asterisks", () => {
    agent.data.messages = [
      { id: "m1", role: "assistant", parts: [{ type: "text", text: "Listo, el cobro **C-0001** quedó creado." }] },
    ];
    render(<DemoScreen />);

    expect(within(chat()).getByText("C-0001").tagName).toBe("STRONG");
    expect(within(chat()).queryByText(/\*\*/)).toBeNull();
  });
});
