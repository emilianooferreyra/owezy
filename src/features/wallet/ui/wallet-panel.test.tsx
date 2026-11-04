// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// A connected wallet without a real one: the panel only reads wagmi's and RainbowKit's hooks.
const ADDRESS = "0x1234567890abcdef1234567890abcdef123456ab";
const wallet = vi.hoisted(() => ({ connected: true, lastConnectError: undefined as unknown }));
vi.mock("wagmi", () => ({
  useAccount: () => (wallet.connected ? { address: ADDRESS, isConnected: true } : { isConnected: false }),
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
// wagmi's connect attempts, as RainbowKit's modal runs them: the panel reads the newest one.
vi.mock("@tanstack/react-query", () => ({
  useMutationState: () => (wallet.lastConnectError === undefined ? [] : [wallet.lastConnectError]),
}));
import { TOKENS } from "@/core/celo/tokens";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { WalletPanel } from "./wallet-panel";

afterEach(() => {
  cleanup();
  wallet.connected = true;
  wallet.lastConnectError = undefined;
});

/** Connected, the header shows the short address; the card with the balances opens from it. */
const openCard = () => fireEvent.click(screen.getByRole("button", { name: /0x1234…56ab/ }));

describe("WalletPanel, connected", () => {
  it("fits in the header: only the short address shows until the owner opens it", () => {
    render(<WalletPanel />);

    expect(screen.getByRole("button", { name: /0x1234…56ab/ }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Saldo en wARS")).toBeNull();
  });

  it("closes the card with Escape or a tap outside it", () => {
    render(<WalletPanel />);

    openCard();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Saldo en wARS")).toBeNull();

    openCard();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Saldo en wARS")).toBeNull();
  });

  it("tells the business that its charges will arrive at the connected address", () => {
    render(<WalletPanel />);
    openCard();

    const card = screen.getByText("Tus cobros llegarán a").closest("[data-slot='card']") as HTMLElement;
    expect(card.textContent).toContain("0x1234…56ab");
  });

  it("shows the balance of each country's token, read-only", () => {
    render(<WalletPanel />);
    openCard();

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
    openCard();
    expect(screen.getByText("Suas cobranças vão chegar em")).toBeTruthy();
    cleanup();

    render(
      <I18nProvider locale="en">
        <WalletPanel />
      </I18nProvider>,
    );
    openCard();
    expect(screen.getByText("wBRL balance")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Disconnect/ })).toBeTruthy();
  });
});

describe("WalletPanel, not connected", () => {
  it("tells the owner to open MetaMask when a connection request is already waiting there", () => {
    wallet.connected = false;
    wallet.lastConnectError = { code: -32002, message: "Request of type 'wallet_requestPermissions' already pending" };
    render(<WalletPanel />);

    expect(screen.getByRole("alert").textContent).toBe("Abrí MetaMask: tenés una solicitud de conexión esperando.");
  });

  it("says nothing when there is no pending request", () => {
    wallet.connected = false;
    wallet.lastConnectError = { code: 4001, message: "User rejected the request." };
    render(<WalletPanel />);

    expect(screen.getByRole("button", { name: "Conectar billetera" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
