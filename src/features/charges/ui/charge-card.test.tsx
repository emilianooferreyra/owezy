// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import type { ChargeView } from "../charges-feature";
import { ChargeCard } from "./charge-card";
import { DemoProvider, useDemo } from "./demo-context";

const CHARGE: ChargeView = {
  id: "C-0001",
  customer: "Juan Pérez",
  description: "2 docenas de medialunas",
  amount: "85000",
  currency: "wARS",
  status: "pending",
  createdAt: "2026-10-17T15:00:00.000Z",
  paymentLink: "http://localhost:3000/pay/C-0001",
  created: true,
};

/** Shows what the customer's phone would read from the shared demo state. */
function PhoneProbe() {
  const { state } = useDemo();
  return <output aria-label="Bandeja">{state.sent.map((id) => state.charges[id]?.description).join(",")}</output>;
}

/**
 * Like the demo page: it reads the shared state, so every dispatch re-renders the chat, and the
 * tool output is parsed again on each render, so every view is a new object.
 */
function Chat({ views }: { views: readonly ChargeView[] }) {
  useDemo();
  return views.map((view, index) => <ChargeCard key={index} charge={{ ...view }} />);
}

// jsdom has no window.open: sending opens WhatsApp, which the tests only observe.
beforeEach(() => {
  vi.spyOn(window, "open").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A fake status endpoint: answers with the given charges, and records the ids each poll asked for. */
function stubStatusEndpoint(answer: (ids: string[]) => ChargeView[]) {
  const asked: string[][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const ids = (new URL(url, "http://localhost").searchParams.get("ids") ?? "").split(",");
      asked.push(ids);
      return Response.json({ charges: answer(ids) });
    }),
  );
  return asked;
}

async function nextPoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
}

const pending = (id: string): ChargeView => ({ ...CHARGE, id, paymentLink: `http://localhost:3000/pay/${id}` });

describe("ChargeCard", () => {
  it("renders two views of the same charge without an update loop (an agent retry returns created: false)", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <DemoProvider>
        <Chat views={[CHARGE, { ...CHARGE, created: false }]} />
      </DemoProvider>,
    );

    expect(screen.getAllByLabelText("Cobro C-0001")).toHaveLength(2);
    expect(errors).not.toHaveBeenCalled();
  });

  it("shows the amount in the charge's own currency: pesos for Argentina, reais for Brazil", () => {
    render(
      <DemoProvider>
        <ChargeCard charge={CHARGE} />
        <ChargeCard charge={{ ...CHARGE, id: "C-0002", amount: "850", currency: "wBRL" }} />
      </DemoProvider>,
    );

    expect(within(screen.getByLabelText("Cobro C-0001")).getByText("$85.000")).toBeTruthy();
    expect(within(screen.getByLabelText("Cobro C-0002")).getByText("R$ 850")).toBeTruthy();
    expect(screen.queryByText("ARS")).toBeNull();
  });

  it("speaks the page's language", () => {
    render(
      <I18nProvider locale="pt-BR">
        <DemoProvider>
          <ChargeCard charge={{ ...CHARGE, currency: "wBRL", amount: "850" }} />
        </DemoProvider>
      </I18nProvider>,
    );
    expect(screen.getByLabelText("Cobrança C-0001")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar para Juan" })).toBeTruthy();
    cleanup();

    render(
      <I18nProvider locale="en">
        <DemoProvider>
          <ChargeCard charge={CHARGE} />
        </DemoProvider>
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send to Juan" }));
    expect(screen.getByRole("form", { name: "Juan's contact" })).toBeTruthy();
  });

  it("asks a Brazilian customer's mobile in Brazil's format and sends it to WhatsApp with 55", () => {
    render(
      <DemoProvider>
        <ChargeCard charge={{ ...CHARGE, currency: "wBRL", amount: "850" }} />
      </DemoProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviar a Juan" }));
    const form = screen.getByRole("form", { name: "Contacto de Juan" });

    expect(within(form).getByPlaceholderText("11 91234-5678")).toBeTruthy();
    fireEvent.change(within(form).getByLabelText("Celular"), { target: { value: "11 91234-5678" } });
    fireEvent.submit(form);

    expect(screen.getByRole("link", { name: /Abrir en WhatsApp/ }).getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/5511912345678\?text=/,
    );
  });

  describe("sending the charge to the customer", () => {
    function renderCard() {
      render(
        <DemoProvider>
          <ChargeCard charge={CHARGE} />
          <PhoneProbe />
        </DemoProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Enviar a Juan" }));
      return screen.getByRole("form", { name: "Contacto de Juan" });
    }

    it("asks for the customer's contact, with the name already filled in from the charge", () => {
      const form = renderCard();

      expect((within(form).getByLabelText("Nombre") as HTMLInputElement).value).toBe("Juan");
      expect((within(form).getByLabelText("Apellido") as HTMLInputElement).value).toBe("Pérez");
      expect((within(form).getByLabelText("Celular") as HTMLInputElement).value).toBe("");
      expect(screen.getByLabelText("Bandeja").textContent).toBe("");
    });

    it("does not send until the mobile number is a valid one", () => {
      const form = renderCard();

      fireEvent.change(within(form).getByLabelText("Celular"), { target: { value: "2345-6789" } });
      fireEvent.submit(form);

      expect(within(form).getByText(/Revisá el celular/)).toBeTruthy();
      expect(screen.getByLabelText("Bandeja").textContent).toBe("");
    });

    it("puts the charge on the customer's phone and offers the real WhatsApp chat with the message ready", () => {
      const form = renderCard();

      fireEvent.change(within(form).getByLabelText("Celular"), { target: { value: "11 2345-6789" } });
      fireEvent.submit(form);

      expect(screen.getByLabelText("Bandeja").textContent).toBe("2 docenas de medialunas");
      const whatsApp = screen.getByRole("link", { name: /Abrir en WhatsApp/ });
      expect(whatsApp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5491123456789\?text=/);
      expect(whatsApp.getAttribute("target")).toBe("_blank");
    });

    it("opens WhatsApp on the typed number in the same tap, then shows the card as sent", () => {
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      render(
        <DemoProvider>
          <ChargeCard charge={{ ...CHARGE, id: "C-0006", customer: "Mario Casese", amount: "11500" }} />
          <PhoneProbe />
        </DemoProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Enviar a Mario" }));
      const form = screen.getByRole("form", { name: "Contacto de Mario" });
      fireEvent.change(within(form).getByLabelText("Celular"), { target: { value: "01131909679" } });
      fireEvent.click(within(form).getByRole("button", { name: /Enviar por WhatsApp/ }));

      expect(open).toHaveBeenCalledTimes(1);
      const [url, target, features] = open.mock.calls[0] ?? [];
      expect(String(url)).toMatch(/^https:\/\/wa\.me\/5491131909679\?text=/);
      expect(decodeURIComponent(String(url))).toContain("C-0006");
      expect(target).toBe("_blank");
      expect(features).toBe("noopener,noreferrer");
      expect(screen.getByRole("button", { name: /Enviado a Mario/ })).toBeTruthy();
      expect(screen.queryByRole("form", { name: "Contacto de Mario" })).toBeNull();
      expect(screen.getByLabelText("Bandeja").textContent).toBe("2 docenas de medialunas");
      // Still there to open the chat again, with the same link.
      expect(screen.getByRole("link", { name: /Abrir en WhatsApp/ }).getAttribute("href")).toBe(String(url));
    });

    it("does not open WhatsApp while the mobile number is invalid", () => {
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      const form = renderCard();

      fireEvent.change(within(form).getByLabelText("Celular"), { target: { value: "2345-6789" } });
      fireEvent.click(within(form).getByRole("button", { name: /Enviar por WhatsApp/ }));

      expect(open).not.toHaveBeenCalled();
    });
  });

  describe("status polling", () => {
    it("asks for every pending card in one request, instead of one request per card", async () => {
      vi.useFakeTimers();
      const asked = stubStatusEndpoint((ids) => ids.map(pending));

      render(
        <DemoProvider>
          <Chat views={[pending("C-0001"), pending("C-0002"), pending("C-0003")]} />
        </DemoProvider>,
      );
      await nextPoll();

      expect(asked).toEqual([["C-0001", "C-0002", "C-0003"]]);
    });

    it("shows a payment as soon as the poll reports it, and stops asking for that charge", async () => {
      vi.useFakeTimers();
      const asked = stubStatusEndpoint((ids) =>
        ids.map((id) => (id === "C-0001" ? { ...pending(id), status: "paid", paidBy: "simulated-1" } : pending(id))),
      );

      render(
        <DemoProvider>
          <Chat views={[pending("C-0001"), pending("C-0002")]} />
        </DemoProvider>,
      );
      await nextPoll();
      await nextPoll();

      // Checked per card: the old badge stays in the DOM while its exit animation runs.
      expect(within(screen.getByLabelText("Cobro C-0001")).queryByText("Pagado")).not.toBeNull();
      expect(within(screen.getByLabelText("Cobro C-0002")).queryByText("Pagado")).toBeNull();
      expect(asked.at(-1)).toEqual(["C-0002"]);
    });

    it("stops asking for a charge the server no longer has", async () => {
      vi.useFakeTimers();
      const asked = stubStatusEndpoint((ids) => ids.filter((id) => id !== "C-0001").map(pending));

      render(
        <DemoProvider>
          <Chat views={[pending("C-0001"), pending("C-0002")]} />
        </DemoProvider>,
      );
      await nextPoll();
      await nextPoll();

      expect(asked.at(-1)).toEqual(["C-0002"]);
    });

    it("does not poll when no card is pending", async () => {
      vi.useFakeTimers();
      const asked = stubStatusEndpoint(() => []);

      render(
        <DemoProvider>
          <Chat views={[{ ...pending("C-0001"), status: "paid", paidBy: "simulated-1" }]} />
        </DemoProvider>,
      );
      await nextPoll();

      expect(asked).toEqual([]);
    });
  });
});
