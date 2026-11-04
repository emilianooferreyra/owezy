// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "./i18n-provider";
import { LanguageSwitcher } from "./language-switcher";

vi.mock("next/navigation", () => ({ usePathname: () => "/pt-BR/how-it-works" }));

afterEach(cleanup);

describe("LanguageSwitcher", () => {
  it("links to the same page in the other languages and marks the current one", () => {
    render(
      <I18nProvider locale="pt-BR">
        <LanguageSwitcher />
      </I18nProvider>,
    );

    const nav = screen.getByRole("navigation", { name: "Idioma" });
    expect(nav.querySelector('[aria-current="true"]')?.textContent).toBe("PT");
    expect(screen.getByRole("link", { name: "Español" }).getAttribute("href")).toBe("/es-AR/how-it-works");
    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en/how-it-works");
    expect(screen.queryByRole("link", { name: "Português" })).toBeNull();
  });
});
