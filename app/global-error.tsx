"use client"; // Error boundaries must be Client Components.

import ErrorPage from "./[lang]/error";
import "./globals.css";

/**
 * Replaces the root layout when the layout itself fails, so it brings its own document and
 * global styles. Metadata exports are not supported here, hence React's <title>.
 */
export default function GlobalError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-AR">
      <body>
        <title>Algo salió mal</title>
        <ErrorPage {...props} />
      </body>
    </html>
  );
}
