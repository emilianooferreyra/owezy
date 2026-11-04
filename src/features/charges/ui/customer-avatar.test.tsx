// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomerAvatar, initialsOf } from "./customer-avatar";

afterEach(cleanup);

describe("CustomerAvatar", () => {
  it("writes the customer's initials: first and last name, or the only name", () => {
    expect(initialsOf("Juan Pérez")).toBe("JP");
    expect(initialsOf("María José Gómez")).toBe("MG");
    expect(initialsOf("ana")).toBe("A");
    expect(initialsOf("  ")).toBe("?");
  });

  it("gives each customer the same color every time, so the owner recognizes them at a glance", () => {
    const { container: first } = render(<CustomerAvatar name="Juan Pérez" />);
    const color = (first.firstElementChild as HTMLElement).className;
    cleanup();
    const { container: again } = render(<CustomerAvatar name="Juan Pérez" />);

    expect((again.firstElementChild as HTMLElement).className).toBe(color);
  });

  it("is decorative: the name next to it is what gets read", () => {
    render(<CustomerAvatar name="Carlos Ruiz" />);

    expect(screen.getByText("CR").getAttribute("aria-hidden")).toBe("true");
  });
});
