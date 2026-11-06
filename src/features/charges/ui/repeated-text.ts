import type { EveMessagePart } from "eve/react";

/** The words and figures of a text, without whitespace or punctuation: "$11.500" and "$11 500" match. */
const normalized = (text: string) => text.replace(/[\s\p{P}]+/gu, "");

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
