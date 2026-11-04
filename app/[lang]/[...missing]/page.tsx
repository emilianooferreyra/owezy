import { notFound } from "next/navigation";

// Any path under a locale that no page handles shows that locale's 404, inside its layout.
export default function MissingPage() {
  notFound();
}
