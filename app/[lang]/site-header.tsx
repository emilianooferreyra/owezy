import Link from "next/link";
import { getDictionary, type Locale, localePath } from "@/core/i18n";
import { LanguageSwitcher } from "@/core/i18n/language-switcher";
import { OwezyMark } from "@/core/ui/owezy-mark";

/**
 * The top bar of the public pages: the brand on the left, the detail page and the language on the
 * right. It sits inside the page's own width, so it lines up with the content below it.
 */
export function SiteHeader({ lang, className = "max-w-6xl" }: { lang: Locale; className?: string }) {
  const { common } = getDictionary(lang);

  return (
    <header className={`mx-auto flex w-full items-center justify-between gap-3 px-4 pt-5 ${className}`}>
      <Link href={localePath(lang)} className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
        {/* The ledger mascot is decorative here: the link reads "Owezy". */}
        <OwezyMark size={32} />
        Owezy
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href={localePath(lang, "/how-it-works")}
          className="hidden text-sm font-medium text-primary hover:underline sm:block"
        >
          {common.howItWorksShort}
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
