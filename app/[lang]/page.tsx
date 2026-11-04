import { ArrowRight, BellRing, CircleCheck, NotebookPen, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type Dictionary, getDictionary, hasLocale, localePath } from "@/core/i18n";
import { Button } from "@/core/ui/button";
import { SampleLedger } from "./sample-ledger";

const REPO_URL = "https://github.com/emilianooferreyra/owezy";

// The ledger flow at a glance; /how-it-works explains each step.
const STEP_ICONS = [NotebookPen, Send, BellRing] as const;

const BUBBLE = "w-fit max-w-xs rounded-2xl px-4 py-2 text-sm shadow-sm";

/** The product in one picture: the owner writes, the agent notes it, the ledger charges, the customer pays. */
function HeroScene({ copy }: { copy: Dictionary["landing"] }) {
  return (
    <div className="relative grid w-full max-w-md gap-3 justify-self-center">
      <div
        aria-hidden="true"
        className="absolute -inset-10 -z-10 rounded-full bg-highlight/50 blur-3xl dark:bg-highlight/15"
      />
      <div aria-hidden="true" className="grid gap-2">
        <p className={`${BUBBLE} justify-self-end rounded-br-md bg-primary text-primary-foreground`}>{copy.sceneOwner}</p>
        <p className={`${BUBBLE} inline-flex items-center gap-2 bg-card ring-1 ring-foreground/5`}>
          <CircleCheck className="size-4 text-success" /> {copy.sceneNoted}
        </p>
      </div>
      <SampleLedger />
      <p
        aria-hidden="true"
        className="absolute -right-3 -bottom-5 inline-flex rotate-2 items-center gap-2 rounded-2xl bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-lg"
      >
        {copy.scenePaid}
      </p>
    </div>
  );
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { landing, common } = getDictionary(lang);

  return (
    <main className="mx-auto grid max-w-6xl gap-20 px-4 py-8">
      <section className="grid items-center gap-14 lg:grid-cols-2">
        <div className="grid justify-items-center gap-6 text-center lg:justify-items-start lg:text-left">
          <span className="rounded-full bg-highlight px-3 py-1 text-sm font-medium text-highlight-foreground">
            {landing.badge}
          </span>
          <h1 className="grid gap-2 text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
            Owezy
            <span className="text-2xl text-primary sm:text-4xl">{landing.tagline}</span>
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">{landing.intro}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild size="lg">
              <Link href={localePath(lang, "/demo")}>
                {common.tryDemo} <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href={localePath(lang, "/how-it-works")}>{common.howItWorks}</Link>
            </Button>
          </div>
        </div>
        <HeroScene copy={landing} />
      </section>

      <section aria-labelledby="how-it-works" className="grid justify-items-center gap-6">
        <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
          {landing.howItWorks}
        </h2>
        <ol className="grid w-full gap-3 sm:grid-cols-3">
          {landing.steps.map(({ title, example }, index) => {
            const Icon = STEP_ICONS[index] ?? NotebookPen;
            return (
              <li key={title} className="grid gap-2 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-foreground/5">
                <span aria-hidden="true" className="grid size-10 place-items-center rounded-2xl bg-highlight">
                  <Icon className="size-5 text-highlight-foreground" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{example}</p>
              </li>
            );
          })}
        </ol>
        <p className="grid justify-items-center gap-1 text-center text-sm">
          <span className="font-medium">
            <span aria-hidden="true">🇦🇷 🇧🇷 </span>
            {landing.countries}
          </span>
          <span className="text-muted-foreground">
            {landing.countriesNext}{" "}
            <span aria-hidden="true" className="opacity-60">
              🇲🇽 🇨🇴 🇵🇪 🇨🇱
            </span>
          </span>
        </p>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-6 text-sm text-muted-foreground">
        <span>{landing.builtWith}</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
          {common.viewCode} <ArrowRight className="size-4" aria-hidden="true" />
        </a>
      </footer>
    </main>
  );
}
