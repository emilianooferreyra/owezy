// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";
import NotFound from "./not-found";
import PayNotFound from "./pay/[id]/not-found";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("error page", () => {
  it("lets the person try again, which re-fetches and re-renders the page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();

    render(<ErrorPage error={new Error("boom")} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it("never shows the technical message, and logs it for debugging instead", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("ENOENT: .data/charges.json");

    render(<ErrorPage error={error} retry={() => {}} />);

    expect(screen.queryByText(/ENOENT/)).toBeNull();
    expect(log).toHaveBeenCalledWith(error);
  });
});

describe("not found pages", () => {
  it("offers the way back home for an unknown address", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "No encontramos esta página" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver al inicio" }).getAttribute("href")).toBe("/es-AR");
  });

  it("tells a payer the payment link does not exist, and to ask the business for a new one", () => {
    render(<PayNotFound />);

    expect(screen.getByRole("heading", { name: "Este link de pago no existe" })).toBeTruthy();
    expect(screen.getByText(/Pedile al negocio un link nuevo/)).toBeTruthy();
  });
});
