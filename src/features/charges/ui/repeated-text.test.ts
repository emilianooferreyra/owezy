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

  it("treats the same confirmation with another thousands separator or bold as the same message", () => {
    // The two texts the demo showed for C-0006: one create_charge call, then the confirmation twice.
    const parts = [
      tool,
      step,
      text("Listo, generé el link de pago para Mario Casese. La referencia es **C-0006** y el importe es $11.500."),
      step,
      text("Listo, generé el link de pago para Mario Casese. La referencia es C-0006 y el importe es $11 500."),
    ];

    expect([...repeatedTextParts(parts)]).toEqual([4]);
  });

  it.each([
    ["a question and a statement", "¿Ya pagó Juan?", "Ya pagó Juan."],
    ["emails that differ by a dot", "Le escribo a ana.perez@mail.com.", "Le escribo a anaperez@mail.com."],
    ["references that differ by a hyphen", "La referencia es C-0006.", "La referencia es C0006."],
    ["the same words with other punctuation", "Listo, quedó creado.", "Listo: quedó creado"],
    ["a single asterisk that is not bold", "El pedido tiene 2*3 unidades.", "El pedido tiene 23 unidades."],
  ])("keeps %s: punctuation can change the meaning", (_case, first, second) => {
    expect([...repeatedTextParts([text(first), text(second)])]).toEqual([]);
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

  it.each([
    ["a decimal comma", "El importe es R$1150.", "El importe es R$11,50."],
    ["a decimal point", "The amount is $1150.", "The amount is $11.50."],
    ["a dot that is not a thousands separator", "El importe es $1150.", "El importe es $1.150,5."],
    ["a comma read as thousands in one text and decimals in the other", "El importe es $11.500.", "El importe es $11,500."],
  ])("keeps a corrected amount that differs only by %s", (_case, first, second) => {
    expect([...repeatedTextParts([text(first), text(second)])]).toEqual([]);
  });

  it("keeps texts that differ only in where words break", () => {
    expect([...repeatedTextParts([text("Cobrale a Ana María."), text("Cobrale a AnaMaría.")])]).toEqual([]);
  });

  it("keeps texts that differ in their digits", () => {
    expect([...repeatedTextParts([text("El importe es $11.500."), text("El importe es $11.501.")])]).toEqual([]);
  });
});
