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

beforeEach(() => {
  agent.status = "ready";
  agent.send = vi.fn(() => Promise.resolve());
  agent.data.messages = [];
});

afterEach(cleanup);

const chat = () => screen.getByRole("region", { name: "Negocio" });

describe("demo chat", () => {
  it("greets the owner with the two things a shop needs: a payment link to share, and checking a charge", () => {
    render(<DemoScreen />);

    const greeting = within(chat()).getByRole("note", { name: "Qué puede hacer el asistente" });
    expect(within(greeting).getByText(/Crear un link de cobro/)).toBeTruthy();
    expect(within(greeting).getByText(/Fijarme cómo está un cobro/)).toBeTruthy();
    expect(within(greeting).queryByText(/quién te debe/)).toBeNull();
  });

  it("shows the owner what the agent reconciled on its own, next to the chat", () => {
    render(<DemoScreen />);

    expect(within(chat()).getByRole("region", { name: "Lo que hice solo" })).toBeTruthy();
  });

  it("shows the agent's **bold** as bold, not as asterisks", () => {
    agent.data.messages = [
      { id: "m1", role: "assistant", parts: [{ type: "text", text: "Listo, el cobro **C-0001** quedó creado." }] },
    ];
    render(<DemoScreen />);

    expect(within(chat()).getByText("C-0001").tagName).toBe("STRONG");
    expect(within(chat()).queryByText(/\*\*/)).toBeNull();
  });

  it("sends a suggestion with one tap", () => {
    render(<DemoScreen />);

    fireEvent.click(within(chat()).getByRole("button", { name: /Kevin Ferreira/ }));

    expect(agent.send).toHaveBeenCalledWith(
      "Creame un link de cobro para Kevin Ferreira por $25.000 por un pedido de alfajores",
    );
  });

  it("holds the suggestions while the agent answers, so taps do not pile up", () => {
    agent.status = "streaming";
    render(<DemoScreen />);

    const suggestion = within(chat()).getByRole("button", { name: /Kevin Ferreira/ });
    expect((suggestion as HTMLButtonElement).disabled).toBe(true);
  });
});
