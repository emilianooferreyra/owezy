import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Calculator,
  ExternalLink,
  FileSearch,
  Landmark,
  type LucideIcon,
  MessageSquareText,
  Radar,
  Receipt,
  ShieldCheck,
  Smartphone,
  User,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { type Dictionary, getDictionary, hasLocale, type Locale, localePath } from "@/core/i18n";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

export async function generateMetadata({ params }: PageProps<"/[lang]/how-it-works">): Promise<Metadata> {
  const { lang } = await params;
  return hasLocale(lang) ? { title: getDictionary(lang).meta.howItWorksTitle } : {};
}

const REPO_URL = "https://github.com/emilianooferreyra/owezy";

// Where a judge checks each criterion, in the order of the dictionary's `judges` (none for impact).
const WARS_ON_CELOSCAN = "https://celoscan.io/token/0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d";
const ERC8004_REGISTRATION =
  "https://celo-sepolia.blockscout.com/tx/0xaf510704d7006dfabe26880e72b7020e30c8af51b393ba79e8a53e28813cdba8";
const AGENT_WALLET = "https://celo-sepolia.blockscout.com/address/0xEA93f4D017BFF57a4E79CFC19b98BDb6CeA4f99c";

function judgeLink(lang: Locale, index: number): string | undefined {
  const demo = localePath(lang, "/demo");
  return [WARS_ON_CELOSCAN, REPO_URL, demo, demo, undefined, ERC8004_REGISTRATION][index];
}

const PROBLEM_ICONS = [FileSearch, Calculator, Smartphone] as const;
const STEP_ICONS = [MessageSquareText, Receipt, Landmark, Radar, Bot] as const;
const LAYER_ICONS = [User, MessageSquareText, Bot, Wallet] as const;
const STATE_BADGE = { works: "default", simulated: "secondary", soon: "outline" } as const;
type State = keyof typeof STATE_BADGE;

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-6">
      <div className="grid gap-1">
        <h2 id={id} className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        {intro && <p className="text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="mb-2 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

function Actions({ lang, common }: { lang: Locale; common: Dictionary["common"] }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <Link href={localePath(lang, "/demo")}>
          {common.tryDemo} <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {common.viewCode} <ExternalLink aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

export default async function HowItWorksPage({ params }: PageProps<"/[lang]/how-it-works">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { howItWorks: copy, common } = getDictionary(lang);

  return (
    <>
    <SiteHeader lang={lang} />
    <main className="mx-auto grid max-w-6xl gap-16 px-4 py-8">
      <header className="grid gap-6">
        <Button asChild variant="link" size="sm" className="w-fit px-0">
          <Link href={localePath(lang)}>
            <ArrowLeft aria-hidden="true" /> {common.backToApp}
          </Link>
        </Button>
        <span className="w-fit rounded-full bg-card px-3 py-1 text-sm text-muted-foreground shadow-sm ring-1 ring-foreground/5">
          {copy.badge}
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{copy.title}</h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{copy.intro}</p>
        <Actions lang={lang} common={common} />
      </header>

      <Section id="the-problem" title={copy.problemTitle}>
        <ul className="grid gap-4 sm:grid-cols-3">
          {copy.problems.map(({ title, description }, index) => (
            <li key={title}>
              <Card className="h-full">
                <CardHeader>
                  <IconBadge icon={PROBLEM_ICONS[index] ?? FileSearch} />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="step-by-step" title={copy.stepsTitle} intro={copy.stepsIntro}>
        <ol className="grid gap-4">
          {copy.steps.map(({ title, description }, index) => (
            <li key={title}>
              <Card size="sm">
                <CardHeader>
                  <IconBadge icon={STEP_ICONS[index] ?? Bot} />
                  <CardTitle>
                    <span className="text-muted-foreground">{index + 1}.</span> {title}
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="an-example" title={copy.exampleTitle} intro={copy.exampleIntro}>
        <Card>
          <CardContent className="grid gap-4 text-sm">
            <ul className="grid gap-2">
              {copy.exampleCharges.map(({ id, line, amount }) => (
                <li key={id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-mono">{id}</span> · {line}
                  </span>
                  <span className="font-semibold">{amount}</span>
                </li>
              ))}
            </ul>
            <p>
              <span className="font-medium">{copy.exampleMatchLead}</span>{" "}
              <span className="text-muted-foreground">{copy.exampleMatch}</span>
            </p>
            <p>
              <span className="font-medium">{copy.exampleAmbiguousLead}</span>{" "}
              <span className="text-muted-foreground">{copy.exampleAmbiguous}</span>
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section id="real-today" title={copy.realTodayTitle} intro={copy.realTodayIntro}>
        <ul className="grid gap-3">
          {copy.realToday.map(({ piece, state, detail }) => (
            <li key={piece} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b pb-3">
              <div className="grid gap-0.5">
                <span className="font-medium">{piece}</span>
                <span className="text-sm text-muted-foreground">{detail}</span>
              </div>
              <Badge variant={STATE_BADGE[state as State]}>{copy.states[state as State]}</Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how-it-is-built" title={copy.builtTitle} intro={copy.builtIntro}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.layers.map(({ title, points }, index) => (
            <li key={title}>
              <Card size="sm" className="h-full">
                <CardHeader>
                  <IconBadge icon={LAYER_ICONS[index] ?? Bot} />
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-1 text-sm text-muted-foreground">
                    {points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="guarantees" title={copy.guaranteesTitle}>
        <ul className="grid gap-3">
          {copy.guarantees.map((guarantee) => (
            <li key={guarantee} className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              <span>{guarantee}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="for-judges" title={copy.judgesTitle} intro={copy.judgesIntro}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.judges.map((item, index) => {
            const href = judgeLink(lang, index);
            return (
              <li key={item.criterion}>
                <Card size="sm" className="h-full">
                  <CardHeader>
                    <CardTitle>
                      <h3>{item.criterion}</h3>
                    </CardTitle>
                    <CardDescription>{item.evidence}</CardDescription>
                  </CardHeader>
                  {href && "link" in item && (
                    <CardContent className="mt-auto">
                      <a
                        href={href}
                        {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        {item.link} <ArrowRight className="size-4" aria-hidden="true" />
                      </a>
                    </CardContent>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="links" title={copy.linksTitle}>
        <Actions lang={lang} common={common} />
        {/* The on-chain proof in one place, as judges look for it. */}
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[
            { href: "/agent.json", label: copy.proof.agentCard },
            { href: ERC8004_REGISTRATION, label: copy.proof.registration },
            { href: AGENT_WALLET, label: copy.proof.agentWallet },
          ].map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {label} <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </main>
    <SiteFooter />
    </>
  );
}
