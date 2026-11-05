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

  it("keeps different texts, and texts that only repeat across separate answers", () => {
    expect([...repeatedTextParts([text("Te anoto a Juan."), tool, text("Listo, anotado.")])]).toEqual([]);
  });
});
