import { type NextRequest, NextResponse } from "next/server";
import { hasLocale, localePath, negotiateLocale } from "@/core/i18n/locales";

/**
 * Every page lives under its locale (/es-AR, /pt-BR, /en). A path without one, such as /demo or
 * a payment link /pay/C-0001, is redirected to the visitor's language, Spanish when it is unknown.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, first = ""] = pathname.split("/");
  if (hasLocale(first)) return;

  const locale = negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = localePath(locale, pathname);
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  // Not the API, the agent (/eve), Next.js internals, the generated icons or files such as /agent.json.
  matcher: ["/((?!api|eve|_next|_vercel|icon|apple-icon|.*\\..*).*)"],
};
