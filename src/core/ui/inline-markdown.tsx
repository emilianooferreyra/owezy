import type { ReactNode } from "react";

// **text** with no space just inside the asterisks, as Markdown requires: "a ** b **" stays as is.
export const BOLD = /\*\*(\S(?:[^*\n]*\S)?)\*\*/g;

/**
 * Shows a model's reply with its **bold** spans as bold. The model writes Markdown, but a chat
 * bubble needs only this much; everything else stays plain text. React escapes every piece, so a
 * message can never inject markup.
 */
export function InlineMarkdown({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    parts.push(text.slice(last, match.index), <strong key={match.index}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}
