// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/core/i18n/i18n-provider";
import { WalletSection } from "./wallet-section";

const connectButton = () => screen.getByRole("button", { name: "Conectar billetera" }) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("WalletSection", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "test-project-id");
  });

  it("shows the connect button right away, disabled until the wallet code arrives, so the page does not jump", () => {
    render(<WalletSection />);

    expect(connectButton().disabled).toBe(true);
  });

  it("swaps in the working wallet panel once its code has loaded", async () => {
    render(<WalletSection />);

    await expect.poll(() => connectButton().disabled, { timeout: 10_000 }).toBe(false);
  }, 15_000);

  it("opens the wallet list, Valora included, when the person connects", async () => {
    render(<WalletSection />);
    await expect.poll(() => connectButton().disabled, { timeout: 10_000 }).toBe(false);

    fireEvent.click(connectButton());

    expect(await screen.findByText("Valora", {}, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText("MetaMask")).toBeTruthy();
  }, 15_000);

  it("points the wallet explainer to a page that exists, in Spanish (RainbowKit's default is a 404)", async () => {
    render(<WalletSection />);
    await expect.poll(() => connectButton().disabled, { timeout: 10_000 }).toBe(false);

    fireEvent.click(connectButton());

    const learnMore = await screen.findByRole("link", { name: "Obtener más información" }, { timeout: 10_000 });
    expect(learnMore.getAttribute("href")).toBe("https://ethereum.org/es/wallets/");
  }, 15_000);
});

describe("WalletSection in English", () => {
  it("labels the connect button in the page's language", () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "test-project-id");

    render(
      <I18nProvider locale="en">
        <WalletSection />
      </I18nProvider>,
    );

    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeTruthy();
  });

  it("says in the page's language that connecting is not set up", () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");

    render(
      <I18nProvider locale="pt-BR">
        <WalletSection />
      </I18nProvider>,
    );

    expect(screen.getByText(/A conexão de carteiras não está configurada/)).toBeTruthy();
  });
});

describe("WalletSection without a WalletConnect project id", () => {
  it("explains that connecting is not set up, instead of breaking the page", () => {
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");

    render(<WalletSection />);

    expect(screen.getByText(/La conexión de billeteras no está configurada/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar billetera" })).toBeNull();
  });
});
