import { cn } from "@/core/lib/utils";

// A few warm colors from the theme; a customer always gets the same one.
const COLORS = [
  "bg-highlight text-highlight-foreground",
  "bg-primary text-primary-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-[oklch(0.9_0.06_60)] text-[oklch(0.35_0.08_50)]",
] as const;

/** "Juan Pérez" → "JP", "ana" → "A": first and last name, as a contacts app shows them. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return (first + last).toLocaleUpperCase() || "?";
}

function colorOf(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? COLORS[0];
}

/** The customer's initials in their color. Decorative: the name next to it is what gets read. */
export function CustomerAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold", colorOf(name), className)}
    >
      {initialsOf(name)}
    </span>
  );
}
