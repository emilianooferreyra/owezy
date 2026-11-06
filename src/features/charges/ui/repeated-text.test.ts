import type { EveMessagePart } from "eve/react";
import { describe, expect, it } from "vitest";
import { repeatedTextParts } from "./repeated-text";

const text = (value: string) => ({ type: "text", text: value }) as EveMessagePart;
const step = { type: "step-start" } as EveMessagePart;
const tool = { type: "dynamic-tool", toolName: "create_charge", state: "output-available" } as unknown as EveMessagePart;

describe("repeatedTextParts", () => {
  it("hides the confirmation the model repeats in the extra step after an approval", () => {
    const confirmation = "Listo, el cobro quedó creado con referencia **C-0005** para Pablo Pio por $100.000.";
    const parts = [step, tool, step, text(confirmation), step, text(confirmation)];

    expect([...repeatedTextParts(parts)]).toEqual([5]);
  });

  it("treats the same words with different spacing as the same message", () => {
    expect([...repeatedTextParts([text("Listo, quedó creado."), text("  Listo, quedó  creado.\n")])]).toEqual([1]);
  });

  it("treats the same confirmation written with other punctuation or spacing as the same message", () => {
    // From a production trace: one create_charge call, then the confirmation twice.
    const parts = [
      tool,
      step,
      text("Listo, generé el link de pago de Mario Casese, la referencia C-0006 y el importe de $11.500."),
      step,
      text("Listo: generé el link de pago de Mario Casese — la referencia **C-0006** y el importe de $11 500"),
    ];

    expect([...repeatedTextParts(parts)]).toEqual([4]);
  });

  it("keeps different texts, and texts that only repeat across separate answers", () => {
    expect([...repeatedTextParts([text("Te anoto a Juan."), tool, text("Listo, anotado.")])]).toEqual([]);
  });

  it("keeps a text that repeats after a tool ran in between", () => {
    const parts = [text("Listo, anotado."), step, tool, step, text("Listo, anotado.")];

    expect([...repeatedTextParts(parts)]).toEqual([]);
  });

  it("only compares a text with the one right before it", () => {
    expect([...repeatedTextParts([text("Hola."), text("Listo."), text("Hola.")])]).toEqual([]);
  });

  it("keeps texts that differ in their digits", () => {
    expect([...repeatedTextParts([text("El importe es $11.500."), text("El importe es $11.501.")])]).toEqual([]);
  });
});
