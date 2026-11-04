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
import type { ReactNode } from "react";
import { Badge } from "@/core/ui/badge";
import { Button } from "@/core/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui/card";
import { WalletSection } from "@/features/wallet/ui";

export const metadata: Metadata = { title: "Cómo funciona" };

const REPO_URL = "https://github.com/emilianooferreyra/owezy";

type Item = { icon: LucideIcon; title: string; description: string };

const PROBLEMS: Item[] = [
  {
    icon: FileSearch,
    title: "La plata llega sin contexto",
    description:
      "Entra una transferencia y tenés que averiguar quién la mandó y por qué. Con una docena de clientes, se te va la tarde.",
  },
  {
    icon: Calculator,
    title: "Conciliar es a mano",
    description:
      "La mayoría de las PyMEs tiene una planilla al lado del home banking y tacha cobros uno por uno. Un error es reclamarle a alguien que ya pagó.",
  },
  {
    icon: Smartphone,
    title: "Tu cliente no va a aprender cripto",
    description:
      "Cobrar en Celo es barato e instantáneo, pero pedirle a un cliente que instale una billetera es perder la venta. Tiene que pagar como ya paga.",
  },
];

const STEPS: Item[] = [
  {
    icon: MessageSquareText,
    title: "Le pedís el cobro al asistente",
    description:
      "«Cobrale $85.000 a Juan Pérez por 2 docenas de medialunas». El agente usa su herramienta create_charge, y el código valida el monto antes de guardar nada.",
  },
  {
    icon: Receipt,
    title: "Se crea el cobro",
    description:
      "Recibe el número siguiente, C-0001, y su link de pago. Si el pedido se repite en el mismo turno, devuelve el mismo cobro: nunca un duplicado.",
  },
  {
    icon: Landmark,
    title: "Tu cliente paga",
    description:
      "El link abre el on-ramp de Ripio: tu cliente paga en pesos desde su banco y tu billetera recibe wARS, el peso digital de Ripio en Celo.",
  },
  {
    icon: Radar,
    title: "El agente mira la blockchain",
    description:
      "Lee las transferencias de wARS que llegan a tu dirección en Celo mainnet. Para leer no necesita claves ni firma nada.",
  },
  {
    icon: Bot,
    title: "Concilia y te avisa",
    description:
      "Cada transferencia se asigna al cobro pendiente con ese monto exacto. El cobro pasa a pagado y las dos partes reciben su comprobante. Y le podés preguntar «¿quién me debe?» cuando quieras.",
  },
];

const REAL_TODAY: { piece: string; state: "Funciona" | "Simulado por defecto" | "Próximamente"; detail: string }[] = [
  { piece: "El agente y sus herramientas", state: "Funciona", detail: "Agente en eve sobre Groq, con create_charge y list_charges." },
  { piece: "Cobros y conciliación", state: "Funciona", detail: "Números de cobro, idempotencia y asignación de pagos, con tests." },
  { piece: "Billetera y saldo en wARS", state: "Funciona", detail: "Leído de Celo mainnet. Solo lectura." },
  {
    piece: "El pago del cliente",
    state: "Simulado por defecto",
    detail: "Un checkout simulado, para que una demo nunca mueva plata real. El ramp de Ripio se activa con una configuración.",
  },
  { piece: "Identidad del agente (ERC-8004) y atribución (ERC-8021)", state: "Próximamente", detail: "Todavía no está hecho." },
];

const LAYERS: { icon: LucideIcon; title: string; points: string[] }[] = [
  { icon: User, title: "Vos", points: ["Chateás con el agente", "Tu billetera recibe los wARS"] },
  { icon: MessageSquareText, title: "La app", points: ["Next.js 16, React 19", "Tu chat y el celular del cliente, lado a lado"] },
  { icon: Bot, title: "El agente", points: ["eve (Vercel), gpt-oss-120b en Groq", "Dos herramientas tipadas, nada más"] },
  { icon: Wallet, title: "Celo mainnet", points: ["wARS de Ripio", "Transferencias leídas con viem"] },
];

const GUARANTEES = [
  "No hay claves privadas en el código. La app nunca firma ni mueve plata.",
  "Conectar la billetera es solo lectura: sirve para indicar dónde llegan tus cobros.",
  "Los pagos son simulados salvo que el deploy active explícitamente el ramp real.",
  "La plata nunca es un número con decimales flotantes: los montos son enteros en unidades base, así un saldo nunca muestra plata que no está.",
  "La conciliación nunca adivina: una transferencia ambigua espera a que decida una persona.",
];

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

function Actions() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <Link href="/demo">
          Probar la demo <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Ver el código <ExternalLink aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="mx-auto grid max-w-4xl gap-16 px-4 py-8">
      <header className="grid gap-6">
        <Button asChild variant="link" size="sm" className="w-fit px-0">
          <Link href="/">
            <ArrowLeft aria-hidden="true" /> Volver a la app
          </Link>
        </Button>
        <span className="w-fit rounded-full bg-card px-3 py-1 text-sm text-muted-foreground shadow-sm ring-1 ring-foreground/5">
          Agents on Open Rails · Celo + Ripio
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Un agente que cobra por tu negocio, en pesos
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          Le pedís el cobro como se lo pedirías a alguien. Tu cliente paga desde su banco, en pesos. Vos recibís wARS
          en Celo, y el agente concilia cada pago para que no vuelvas a tachar una planilla.
        </p>
        <Actions />
      </header>

      <Section id="the-problem" title="El problema">
        <ul className="grid gap-4 sm:grid-cols-3">
          {PROBLEMS.map(({ icon, title, description }) => (
            <li key={title}>
              <Card className="h-full">
                <CardHeader>
                  <IconBadge icon={icon} />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="step-by-step" title="Paso a paso" intro="Todo pasa en un chat. El agente responde con tarjetas, no con párrafos.">
        <ol className="grid gap-4">
          {STEPS.map(({ icon, title, description }, index) => (
            <li key={title}>
              <Card size="sm">
                <CardHeader>
                  <IconBadge icon={icon} />
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

      <Section
        id="an-example"
        title="Un ejemplo con números"
        intro="Una panadería tiene dos cobros pendientes. El link del ramp no lleva número de pedido, así que el monto es la única pista."
      >
        <Card>
          <CardContent className="grid gap-4 text-sm">
            <ul className="grid gap-2">
              <li className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="font-mono">C-0001</span> · Juan Pérez · 2 docenas de medialunas
                </span>
                <span className="font-semibold">$85.000</span>
              </li>
              <li className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="font-mono">C-0002</span> · María Gómez · torta de cumpleaños
                </span>
                <span className="font-semibold">$42.500</span>
              </li>
            </ul>
            <p>
              <span className="font-medium">Llega una transferencia de 85.000 wARS.</span>{" "}
              <span className="text-muted-foreground">
                Solo C-0001 está pendiente con ese monto exacto y se creó antes de la transferencia: pasa a pagado y
                Juan recibe su comprobante.
              </span>
            </p>
            <p>
              <span className="font-medium">Si C-0002 también fuera de $85.000,</span>{" "}
              <span className="text-muted-foreground">
                el agente no elige uno. Marca la transferencia como ambigua y te pide que la asignes vos. Un
                &quot;pagado&quot; equivocado es peor que una pregunta.
              </span>
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section id="real-today" title="Qué es real hoy" intro="Una demo nunca debería hacerse pasar por algo que no es.">
        <ul className="grid gap-3">
          {REAL_TODAY.map(({ piece, state, detail }) => (
            <li key={piece} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b pb-3">
              <div className="grid gap-0.5">
                <span className="font-medium">{piece}</span>
                <span className="text-sm text-muted-foreground">{detail}</span>
              </div>
              <Badge variant={state === "Funciona" ? "default" : state === "Próximamente" ? "outline" : "secondary"}>
                {state}
              </Badge>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="how-it-is-built"
        title="Cómo está construido"
        intro="Cuatro capas. La plata vive en Celo, el agente decide, la app conversa, y nada en el medio guarda claves."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map(({ icon, title, points }) => (
            <li key={title}>
              <Card size="sm" className="h-full">
                <CardHeader>
                  <IconBadge icon={icon} />
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

      <Section id="guarantees" title="Garantías">
        <ul className="grid gap-3">
          {GUARANTEES.map((guarantee) => (
            <li key={guarantee} className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              <span>{guarantee}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="your-wallet"
        title="Dónde recibís tus cobros"
        intro="Conectá la billetera donde querés recibir y mirá tu saldo en wARS. Solo lectura: no firmás nada."
      >
        <div className="grid justify-items-center">
          <WalletSection />
        </div>
      </Section>

      <Section id="links" title="Links">
        <Actions />
      </Section>
    </main>
  );
}
