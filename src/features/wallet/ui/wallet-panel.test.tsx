// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// A connected wallet without a real one: the panel only reads wagmi's and RainbowKit's hooks.
const ADDRESS = "0x1234567890abcdef1234567890abcdef123456ab";
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: ADDRESS, isConnected: true }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  // Each token's balance contract answers with its own amount: 1.500 wARS and 25 wBRL.
  useReadContract: ({ address }: { address: string }) => ({
    data: address === TOKENS.wBRL ? 25n * 10n ** 18n : 1500n * 10n ** 18n,
    isError: false,
  }),
}));
vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn(), connectModalOpen: false }),
}));
import { TOKENS } from "@/core/celo/tokens";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { WalletPanel } from "./wallet-panel";

afterEach(cleanup);

describe("WalletPanel, connected", () => {
  it("tells the business that its charges will arrive at the connected address", () => {
    render(<WalletPanel />);

    expect(screen.getByText("Tus cobros llegarán a")).toBeTruthy();
    expect(screen.getByText("0x1234…56ab")).toBeTruthy();
  });

  it("shows the balance of each country's token, read-only", () => {
    render(<WalletPanel />);

    expect(screen.getByText("Saldo en wARS")).toBeTruthy();
    expect(screen.getByText("$1.500")).toBeTruthy();
    expect(screen.getByText("Saldo en wBRL")).toBeTruthy();
    expect(screen.getByText("R$ 25")).toBeTruthy();
  });

  it("speaks the page's language", () => {
    render(
      <I18nProvider locale="pt-BR">
        <WalletPanel />
      </I18nProvider>,
    );
    expect(screen.getByText("Suas cobranças vão chegar em")).toBeTruthy();
    cleanup();

    render(
      <I18nProvider locale="en">
        <WalletPanel />
      </I18nProvider>,
    );
    expect(screen.getByText("wBRL balance")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Disconnect/ })).toBeTruthy();
  });
});
