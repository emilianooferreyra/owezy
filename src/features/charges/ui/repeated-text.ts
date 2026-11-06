import type { EveMessagePart } from "eve/react";

/**
 * A text without the differences that never change its meaning: bold markers, a thousands
 * separator written as a dot or a space ("$11.500" and "$11 500" are one amount), and runs of
 * spaces. Every other mark counts: "¿Ya pagó Juan?" is not "Ya pagó Juan.", and "R$11,50" is not
 * "R$1150". This is only a safety net, since the write tools end the turn, so when in doubt both
 * texts show: hiding a different message is worse than showing a repeat.
 */
const normalized = (text: string) =>
  text
    .replace(/\*+/g, "")
    .replace(/(?<=\d)[.\s  ](?=\d{3}(?!\d))/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

const isTool = (part: EveMessagePart) => part.type === "dynamic-tool" || part.type.startsWith("tool-");

/**
 * Indexes of text parts that repeat the text right before them in the same answer, with no tool
 * call in between. After the owner approves a tool call, eve may run one more model step, and the
 * model sometimes says its confirmation again, even with other spacing or punctuation: the chat
 * shows it once. A text that repeats after a tool ran is a new answer, so it still shows.
 */
export function repeatedTextParts(parts: readonly EveMessagePart[]): ReadonlySet<number> {
  const repeated = new Set<number>();
  let previous: string | undefined;
  parts.forEach((part, index) => {
    if (isTool(part)) {
      previous = undefined;
      return;
    }
    if (part.type !== "text") return;
    const key = normalized(part.text);
    if (key === "") return;
    if (key === previous) repeated.add(index);
    previous = key;
  });
  return repeated;
}
