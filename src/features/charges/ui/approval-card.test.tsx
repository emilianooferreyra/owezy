// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { ApprovalCard, type ApprovalRequest } from "./approval-card";

const OPTIONS = [
  { id: "approve", label: "Approve", style: "primary" as const },
  { id: "cancel", label: "Cancel", style: "danger" as const },
];

function request(toolName: string, input: Record<string, unknown>): ApprovalRequest {
  return { requestId: `request-${toolName}`, prompt: `Approve ${toolName}?`, options: OPTIONS, action: { toolName, input } };
}

afterEach(cleanup);

describe("ApprovalCard", () => {
  it("asks before creating a charge, with who pays, how much and what for", () => {
    render(
      <ApprovalCard
        request={request("create_charge", { customer: "Juan Pérez", description: "2 tortas", amount: "30000", currency: "wARS" })}
        onRespond={() => {}}
      />,
    );

    const card = screen.getByRole("group", { name: "Confirmación" });
    expect(within(card).getByText("¿Creo el cobro de $30.000 a Juan Pérez por 2 tortas?")).toBeTruthy();
  });

  it("asks before writing a purchase down in the ledger", () => {
    render(
      <ApprovalCard
        request={request("add_to_ledger", { customer: "Martina", description: "pan", amount: "5000.5", currency: "wARS" })}
        onRespond={() => {}}
      />,
    );

    expect(screen.getByText("¿Anoto que Martina se llevó pan por $5.000,50?")).toBeTruthy();
  });

  it("asks before sending a customer the link for what they owe", () => {
    render(<ApprovalCard request={request("charge_from_ledger", { customer: "Juan", currency: "wARS" })} onRespond={() => {}} />);

    expect(screen.getByText("¿Le mando a Juan el link por todo lo que tiene sin cobrar en la libreta?")).toBeTruthy();
  });

  it("shows amounts in the shop's currency, in the page's language", () => {
    render(
      <I18nProvider locale="pt-BR">
        <ApprovalCard
          request={request("create_charge", { customer: "João", description: "bolo", amount: "300", currency: "wBRL" })}
          onRespond={() => {}}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Crio a cobrança de R$ 300 para João por bolo?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });

  it("answers with the option the owner taps", () => {
    const onRespond = vi.fn();
    render(<ApprovalCard request={request("charge_from_ledger", { customer: "Juan" })} onRespond={onRespond} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onRespond.mock.calls).toEqual([["request-charge_from_ledger", "approve"], ["request-charge_from_ledger", "cancel"]]);
  });

  it("disables both answers while the chat is busy", () => {
    render(<ApprovalCard request={request("charge_from_ledger", { customer: "Juan" })} onRespond={() => {}} disabled />);

    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("falls back to the agent's own prompt and labels for a tool it does not know, or input it cannot read", () => {
    render(
      <>
        <ApprovalCard request={request("refund_charge", { id: "C-1" })} onRespond={() => {}} />
        <ApprovalCard request={request("create_charge", { customer: 42 })} onRespond={() => {}} />
      </>,
    );

    expect(screen.getByText("Approve refund_charge?")).toBeTruthy();
    expect(screen.getByText("Approve create_charge?")).toBeTruthy();
  });
});
