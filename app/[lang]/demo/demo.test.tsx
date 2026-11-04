// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The chat without a running agent: what matters here is what the owner sees and what gets sent.
const agent = vi.hoisted(() => ({
  status: "ready" as string,
  data: { messages: [] as unknown[] },
  error: undefined,
  send: (() => Promise.resolve()) as (message: string) => Promise<void>,
  /** What the demo passed to useEveAgent, to check what every turn carries. */
  options: undefined as { prepareSend?: (input: { message: string }) => unknown } | undefined,
}));
vi.mock("eve/react", () => ({
  useEveAgent: (options: typeof agent.options) => {
    agent.options = options;
    return agent;
  },
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

  it("shows the agent's **bold** as bold, not as asterisks", () => {
    agent.data.messages = [
      { id: "m1", role: "assistant", parts: [{ type: "text", text: "Listo, el cobro **C-0001** quedó creado." }] },
    ];
    render(<DemoScreen />);

    expect(within(chat()).getByText("C-0001").tagName).toBe("STRONG");
    expect(within(chat()).queryByText(/\*\*/)).toBeNull();
  });
});

describe("demo countries", () => {
  it("opens Bia's Brazilian shop for a Portuguese visitor, reading only the wBRL ledger", async () => {
    await renderPage("pt-BR");

    expect(screen.getByRole("heading", { level: 1, name: "Padaria da Bia" })).toBeTruthy();
    expect(screen.getByText("Seu assistente de cobranças em reais")).toBeTruthy();
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

  it("switches country with links that keep the language, marking the current one", async () => {
    await renderPage("es-AR");

    const countries = screen.getByRole("group", { name: "País" });
    const argentina = within(countries).getByRole("link", { name: /Argentina/ });
    const brasil = within(countries).getByRole("link", { name: /Brasil/ });
    expect(argentina.getAttribute("href")).toBe("/es-AR/demo?country=AR");
    expect(brasil.getAttribute("href")).toBe("/es-AR/demo?country=BR");
    expect(argentina.getAttribute("aria-current")).toBe("true");
    expect(brasil.getAttribute("aria-current")).toBeNull();
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

  it("has the language switcher in the shop's header, not floating over the page", async () => {
    await renderPage("en");

    const shop = screen.getByRole("region", { name: "Shop" });
    const switcher = within(shop).getByRole("navigation", { name: "Language" });
    expect(switcher.closest("header")).toBeTruthy();
  });

  it("lets the shop connect the wallet where its payments arrive, right under the country switch", async () => {
    await renderPage("es-AR");

    const shop = screen.getByRole("region", { name: "Negocio" });
    expect(within(shop).getByText("Dónde recibís tus cobros")).toBeTruthy();
  });
});
