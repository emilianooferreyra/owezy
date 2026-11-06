// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The chat without a running agent: what matters here is what the owner sees and what gets sent.
const agent = vi.hoisted(() => ({
  status: "ready" as string,
  data: { messages: [] as unknown[], inputs: [] as unknown[] },
  error: undefined as (Error & { code?: string }) | undefined,
  send: (() => Promise.resolve()) as (message: string) => Promise<void>,
  respond: (() => Promise.resolve()) as (responses: unknown[]) => Promise<void>,
  /** What the demo passed to useEveAgent, to check what every turn carries. */
  options: undefined as { prepareSend?: (input: { message: string }) => unknown } | undefined,
}));
vi.mock("eve/react", () => ({
  useEveAgent: (options: typeof agent.options) => {
    agent.options = options;
    return agent;
  },
  // The real helper reads eve's projection of open requests; the double keeps them in `data.inputs`.
  openConversationInputs: (data: { inputs: unknown[] }) => data.inputs,
}));
import type { ReactNode } from "react";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { pageProps } from "@/core/i18n/testing";
import type { Locale } from "@/core/i18n";
import { DemoScreen } from "./demo";
import DemoPage from "./page";

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

/** What the agent reconciled on its own, as /api/activity answers it. */
const PAYMENT = {
  id: "payment-matched:tx-1",
  kind: "payment-matched",
  transferId: "tx-1",
  amount: "57000",
  currency: "wARS",
  receivedAt: "2026-11-03T17:05:00.000Z",
  recordedAt: "2026-11-03T17:15:00.000Z",
  chargeId: "C-0001",
  customer: "Juan Pérez",
};

/** The demo's routes: the ledger answers with LEDGER (or `ledgerStatus`), the activity with `activity`. */
let ledgerStatus = 200;
let activity: unknown[] = [];
beforeEach(() => {
  agent.status = "ready";
  agent.error = undefined;
  agent.send = vi.fn(() => Promise.resolve());
  agent.data.messages = [];
  agent.data.inputs = [];
  agent.respond = vi.fn(() => Promise.resolve());
  ledgerStatus = 200;
  activity = [];
  try {
    localStorage.clear();
  } catch {
    // No storage: nothing to clear.
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).startsWith("/api/ledger")
        ? new Response(JSON.stringify(LEDGER), { status: ledgerStatus })
        : new Response(JSON.stringify({ activity, charges: [] })),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const chat = () => screen.getByRole("region", { name: "Negocio" });

/** The demo page as Next.js renders it under /[lang]/demo, with the layout's locale around it. */
async function renderPage(lang: Locale, country?: string) {
  const page = await DemoPage({ ...pageProps(lang), searchParams: Promise.resolve(country ? { country } : {}) });
  const wrap = (children: ReactNode) => <I18nProvider locale={lang}>{children}</I18nProvider>;
  return render(wrap(page));
}

const fetchedUrls = () => vi.mocked(fetch).mock.calls.map(([url]) => String(url));

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

  it("rings the bell with what the agent did on its own that the owner has not seen yet", async () => {
    activity = [PAYMENT];
    render(<DemoScreen />);

    const bell = await within(chat()).findByRole("button", { name: "Actividad, 1 nueva" });
    expect(within(bell).getByText("1")).toBeTruthy();

    fireEvent.click(bell);

    expect(within(chat()).getByRole("region", { name: "Lo que hice solo" })).toBeTruthy();
    expect(within(chat()).getByRole("button", { name: "Actividad" })).toBeTruthy();
  });

  it("tells the owner in the chat when a payment arrives while it is open, not only in the bell", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<DemoScreen />);
      // The first read is history: it stays in the bell.
      await vi.advanceTimersByTimeAsync(100);
      expect(screen.queryByText(/Llegó el pago/)).toBeNull();

      activity = [PAYMENT];
      await vi.advanceTimersByTimeAsync(5_000);

      const notice = await within(chat()).findByRole("status", { name: "Pago recibido" });
      expect(within(notice).getByText("Llegó el pago de Juan Pérez: $57.000 (C-0001)")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not repeat in the chat a payment that was already there when it opened", async () => {
    activity = [PAYMENT];
    render(<DemoScreen />);

    await within(chat()).findByRole("button", { name: "Actividad, 1 nueva" });
    expect(screen.queryByText(/Llegó el pago/)).toBeNull();
  });

  it("does not ring again for what the owner already saw, even after reloading", async () => {
    activity = [PAYMENT];
    const first = render(<DemoScreen />);
    fireEvent.click(await within(chat()).findByRole("button", { name: "Actividad, 1 nueva" }));
    first.unmount();

    render(<DemoScreen />);

    expect(await within(chat()).findByRole("button", { name: "Actividad" })).toBeTruthy();
    expect(within(chat()).queryByRole("button", { name: /nueva/ })).toBeNull();
  });

  it("closes the activity with its X, with Escape, or by tapping outside it", () => {
    render(<DemoScreen />);
    const open = () => fireEvent.click(within(chat()).getByRole("button", { name: /Actividad/ }));
    const panel = () => within(chat()).queryByRole("region", { name: "Lo que hice solo" });

    open();
    fireEvent.click(within(panel() as HTMLElement).getByRole("button", { name: "Cerrar" }));
    expect(panel()).toBeNull();

    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel()).toBeNull();

    open();
    fireEvent.pointerDown(within(chat()).getByRole("textbox"));
    expect(panel()).toBeNull();
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

  it("shows the ledger once per answer, even when the agent read it twice: the newest read wins", () => {
    const read = (toolCallId: string, output: unknown) => ({
      type: "dynamic-tool",
      toolCallId,
      toolName: "read_ledger",
      state: "output-available",
      input: {},
      output,
    });
    const newer = {
      customers: [{ ...LEDGER.customers[0], owed: "0", unbilled: "0", entries: [{ ...LEDGER.customers[0]?.entries[0], status: "paid" }] }],
      totalOwed: "0",
    };
    agent.data.messages = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Cobrale a Juan lo que debe" }] },
      { id: "m2", role: "assistant", parts: [read("t1", LEDGER), read("t2", newer), { type: "text", text: "Juan ya pagó." }] },
    ];
    // Before the greeting's own ledger loads, so every card on screen comes from the answer.
    render(<DemoScreen />);

    const cards = within(chat()).getAllByRole("region", { name: "Libreta" });
    expect(cards).toHaveLength(1);
    expect(within(cards[0] as HTMLElement).getAllByText("$0").length).toBeGreaterThan(0);
    expect(within(cards[0] as HTMLElement).queryByText("$57.000")).toBeNull();
  });

  it("asks the owner before the agent writes, and sends their answer back to the paused call", async () => {
    agent.status = "streaming";
    agent.data.inputs = [
      {
        status: "open",
        request: {
          kind: "tool-approval",
          requestId: "request-1",
          prompt: "Approve create_charge?",
          options: [
            { id: "approve", label: "Approve" },
            { id: "cancel", label: "Cancel" },
          ],
          action: {
            kind: "tool-call",
            callId: "call-1",
            toolName: "create_charge",
            input: { customer: "Juan Pérez", description: "torta", amount: "30000", currency: "wARS" },
          },
        },
      },
    ];
    render(<DemoScreen />);

    const card = screen.getByRole("group", { name: "Confirmación" });
    expect(within(card).getByText("¿Creo el cobro de $30.000 a Juan Pérez por torta?")).toBeTruthy();
    // The turn is waiting on the owner, not thinking.
    expect(screen.queryByText("Pensando…")).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "Confirmar" }));

    expect(agent.respond).toHaveBeenCalledWith([{ requestId: "request-1", optionId: "approve" }]);
  });

  it("shows a confirmation once when the model repeats it after an approval", () => {
    const confirmation = "Listo, el cobro quedó creado para Pablo Pio por $100.000.";
    agent.data.messages = [
      {
        id: "turn_0:assistant",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "text", text: confirmation },
          { type: "step-start" },
          { type: "text", text: confirmation },
        ],
      },
    ];
    render(<DemoScreen />);

    expect(screen.getAllByText(confirmation)).toHaveLength(1);
  });

  it("still shows a corrected amount right after the text it corrects", () => {
    agent.data.messages = [
      {
        id: "turn_0:assistant",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "text", text: "El importe es R$1150." },
          { type: "text", text: "El importe es R$11,50." },
        ],
      },
    ];
    render(<DemoScreen />);

    expect(within(chat()).getByText("El importe es R$1150.")).toBeTruthy();
    expect(within(chat()).getByText("El importe es R$11,50.")).toBeTruthy();
  });

  it("still shows a quantity that differs only by a single asterisk, which is not bold", () => {
    agent.data.messages = [
      {
        id: "turn_0:assistant",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "text", text: "El pedido tiene 2*3 unidades." },
          { type: "text", text: "El pedido tiene 23 unidades." },
        ],
      },
    ];
    render(<DemoScreen />);

    expect(within(chat()).getByText("El pedido tiene 2*3 unidades.")).toBeTruthy();
    expect(within(chat()).getByText("El pedido tiene 23 unidades.")).toBeTruthy();
  });

  it("answers with the charge card alone when the turn ends after the write, without a stuck Pensando…", () => {
    // create_charge ends the turn once it succeeds: eve sends no final text after the card.
    agent.status = "ready";
    agent.data.messages = [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Cobrale 11500 a Mario Casese por una torta" }] },
      {
        id: "m2",
        role: "assistant",
        parts: [
          { type: "step-start" },
          {
            type: "dynamic-tool",
            toolCallId: "t1",
            toolName: "create_charge",
            state: "output-available",
            input: {},
            output: {
              id: "C-0006",
              customer: "Mario Casese",
              description: "una torta",
              amount: "11500",
              currency: "wARS",
              status: "pending",
              createdAt: "2026-11-03T15:00:00.000Z",
              paymentLink: "http://localhost:3000/pay/C-0006",
              created: true,
              amountAdjusted: false,
            },
          },
        ],
      },
    ];
    render(<DemoScreen />);

    const card = within(chat()).getByRole("generic", { name: "Cobro C-0006" });
    expect(within(card).getByText("$11.500")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Enviar a Mario" })).toBeTruthy();
    expect(screen.queryByText("Pensando…")).toBeNull();
  });

  it("shows the agent's **bold** as bold, not as asterisks", () => {
    agent.data.messages = [
      { id: "m1", role: "assistant", parts: [{ type: "text", text: "Listo, el cobro **C-0001** quedó creado." }] },
    ];
    render(<DemoScreen />);

    expect(within(chat()).getByText("C-0001").tagName).toBe("STRONG");
    expect(within(chat()).queryByText(/\*\*/)).toBeNull();
  });

  it("tells the owner the demo reached today's limit when the chat refuses the message, not the raw error", () => {
    agent.status = "error";
    agent.error = Object.assign(new Error("The demo reached today's model budget."), {
      code: "daily_budget_exhausted",
    });
    render(<DemoScreen />);

    expect(within(chat()).getByText(/La demo llegó a su límite de hoy/)).toBeTruthy();
    expect(within(chat()).queryByText(/model budget/)).toBeNull();
    expect(within(chat()).queryByText("Pensando…")).toBeNull();
  });

  it("still shows any other chat error as it came", () => {
    agent.status = "error";
    agent.error = new Error("Network down");
    render(<DemoScreen />);

    expect(within(chat()).getByText("Network down")).toBeTruthy();
  });
});

describe("demo countries", () => {
  it("opens Bia's Brazilian shop for a Portuguese visitor, reading only the wBRL ledger", async () => {
    await renderPage("pt-BR");

    expect(screen.getByRole("heading", { level: 1, name: "Padaria da Bia" })).toBeTruthy();
    expect(screen.getByText("Seu assistente de cobranças")).toBeTruthy();
    expect(await screen.findByText("Oi, Bia! Hoje te devem R$ 57.000 entre 1 cliente.")).toBeTruthy();
    expect(fetchedUrls()).toContain("/api/ledger?currency=wBRL");
    expect(fetchedUrls().some((url) => url.includes("currency=wARS"))).toBe(false);
  });

  it("opens Ana's Argentine shop for everyone else", async () => {
    await renderPage("en");

    expect(screen.getByRole("heading", { level: 1, name: "Panadería de Ana" })).toBeTruthy();
    expect(await screen.findByText("Hi, Ana! Today you are owed $57.000 by 1 customer.")).toBeTruthy();
    expect(fetchedUrls()).toContain("/api/ledger?currency=wARS");
  });

  it("lets ?country=AR open the Argentine shop in Portuguese", async () => {
    await renderPage("pt-BR", "AR");

    expect(screen.getByRole("heading", { level: 1, name: "Panadería de Ana" })).toBeTruthy();
    expect(fetchedUrls()).toContain("/api/ledger?currency=wARS");
  });

  it("keeps the header to the shop, the bell and the wallet: no country or language switch", async () => {
    await renderPage("es-AR");

    const header = screen.getByRole("region", { name: "Negocio" }).querySelector("header") as HTMLElement;
    expect(within(header).getByRole("heading", { level: 1, name: "Panadería de Ana" })).toBeTruthy();
    expect(within(header).getByText("Tu asistente de cobros")).toBeTruthy();
    expect(within(header).getByRole("button", { name: /Actividad/ })).toBeTruthy();
    expect(within(header).queryByRole("group", { name: "País" })).toBeNull();
    expect(within(header).queryByRole("navigation", { name: "Idioma" })).toBeNull();
    expect(within(header).queryByText("Dónde recibís tus cobros")).toBeNull();
  });

  it("asks the activity of the shop's country only", async () => {
    await renderPage("pt-BR");

    fireEvent.click(within(screen.getByRole("region", { name: "Loja" })).getByRole("button", { name: /Atividade/ }));

    expect(fetchedUrls()).toContain("/api/activity?currency=wBRL");
  });

  it("tells the agent, on every turn, which shop is talking and the page's language", async () => {
    await renderPage("pt-BR");

    expect(agent.options?.prepareSend?.({ message: "Quem me deve?" })).toEqual({
      message: "Quem me deve?",
      clientContext: {
        shop: { country: "BR", currency: "wBRL", name: "Padaria da Bia", owner: "Bia" },
        language: "pt-BR",
      },
    });
  });

  it("charges from the ledger in the page's language", async () => {
    await renderPage("en");

    fireEvent.click(await screen.findByRole("button", { name: "Charge Juan Pérez" }));

    expect(agent.send).toHaveBeenCalledWith("Charge Juan Pérez what they owe", undefined);
  });

  it("speaks English around the chat and links home within the locale", async () => {
    await renderPage("en");

    const shop = screen.getByRole("region", { name: "Shop" });
    expect(within(shop).getByRole("textbox", { name: "Message" })).toBeTruthy();
    expect(within(shop).getByRole("button", { name: "Send" })).toBeTruthy();
    expect(within(shop).getByRole("link", { name: /Home/ }).getAttribute("href")).toBe("/en");
    expect(screen.getByRole("region", { name: "Customer" })).toBeTruthy();
  });

  it("links home within the default locale", () => {
    render(<DemoScreen />);

    expect(within(chat()).getByRole("link", { name: /Inicio/ }).getAttribute("href")).toBe("/es-AR");
  });

  it("goes home through Owezy's logo next to the shop's name, not an arrow", () => {
    render(<DemoScreen />);

    const home = within(chat()).getByRole("link", { name: "Inicio" });
    expect(home.querySelector("[data-owezy-mark]")).toBeTruthy();
    expect(home.querySelector(".lucide-arrow-left")).toBeNull();
    expect(home.closest("header")?.querySelector("h1")).toBeTruthy();
  });

  it("puts the wallet in the header's top row, next to the bell", async () => {
    await renderPage("es-AR");

    const bell = screen.getByRole("button", { name: /Actividad/ });
    const row = bell.closest("[data-header-actions]") as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByText(/billetera|Conectar/i)).toBeTruthy();
  });
});
