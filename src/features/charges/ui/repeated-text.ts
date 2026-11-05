import type { EveMessagePart } from "eve/react";

const normalized = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * Indexes of text parts that repeat an earlier text of the same answer. After the owner approves a
 * tool call, eve runs one more model step, and the model sometimes says its confirmation again
 * word for word: the chat shows it once.
 */
export function repeatedTextParts(parts: readonly EveMessagePart[]): ReadonlySet<number> {
  const seen = new Set<string>();
  const repeated = new Set<number>();
  parts.forEach((part, index) => {
    if (part.type !== "text") return;
    const key = normalized(part.text);
    if (key === "") return;
    if (seen.has(key)) repeated.add(index);
    seen.add(key);
  });
  return repeated;
}
