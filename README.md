# Owezy

**They owe, you get paid.**

An AI collections assistant for small businesses in Argentina and Brazil: charge customers in pesos or
reais, get paid in **wARS** or **wBRL** (Ripio's local stablecoins) on **Celo**, and let the agent
reconcile payments for you. The app speaks Spanish (es-AR, the default), Brazilian Portuguese and English.

**Live demo:** [getowezy.vercel.app/demo](https://getowezy.vercel.app/demo). Open
chat, no account needed. It runs with simulated payments, so try paying a charge from the customer's
phone on the right.

> Portfolio and learning project. Payments are **simulated by default**: no real money moves unless you
> explicitly switch to the real Ripio ramp.

## How it works

1. **The owner asks the agent for a charge.** *"Cobrale $85.000 a Juan Pérez por 2 docenas de
   medialunas"*. The agent creates charge `C-0001` with its payment link.
2. **The customer pays from their bank.** In production the link opens Ripio's on-ramp: the customer
   pays in pesos (or reais with Pix) without touching crypto, and the business receives wARS (or wBRL) on Celo.
3. **The agent reconciles.** Each incoming transfer is matched to the pending charge with the exact
   amount. The charge turns *paid* and both sides get a receipt.

The demo at `/demo` shows both sides at once: the owner's chat on the left and the customer's phone on
the right (tabs on mobile), with a switch between the Argentine shop (wARS) and the Brazilian one
(wBRL). `/how-it-works` reads a connected wallet's **real** balance on Celo mainnet (read-only,
nothing is signed). Every page lives under its locale (`/es-AR`, `/pt-BR`, `/en`); a path without one
redirects to the browser's language.

## Stack

| Layer | Choice |
| --- | --- |
| Agent | [eve](https://eve.dev) (Vercel) with two typed tools, `create_charge` and `list_charges` |
| Model | `openai/gpt-oss-120b` on Groq, through the AI SDK |
| Web | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Motion |
| Chain | Celo mainnet, viem + wagmi, RainbowKit for connecting wallets (read-only) |
| Payments | Ripio ramp link, or a simulated checkout for demos |
| Tests | Vitest, written first (TDD) and checked with mutations |

## Architecture

A single project organised by features, with ports and adapters inside each feature:

```
agent/                      eve agent: model, instructions, tools
app/                        Next.js routes: landing, /demo, /pay/[id], /api/charges (status, simulated payment)
src/
  core/
    money/                  Money as bigint base units, parsing and formatting (never `number`)
    storage/                atomic JSON file storage for local demos
    ui/                     shadcn components
  features/
    charges/
      domain/               charges, payment matching, references (C-0001…)
      application/          use cases (create charge, reconcile payments) and ports
      infrastructure/       Ripio link, simulated checkout, on-chain reader, file and in-memory adapters
      ui/                   charge card, payer phone, checkout, receipt
    wallet/                 RainbowKit wallet modal, wARS balance (read-only)
```

Some decisions worth calling out:

- **Money is a `bigint` in base units** (wARS has 18 decimals). Amounts cross JSON as decimal strings,
  and displays truncate instead of rounding: a balance never shows money that is not there.
- **Charge creation is idempotent per request.** The key is the eve session and turn plus the charge
  details, so a retried agent step returns the same charge instead of a duplicate.
- **Reconciliation never guesses.** The ramp link carries no order reference, so the amount is the only
  key. If two pending charges share an amount, the transfer is flagged as ambiguous for a person to
  assign, and a transfer only pays charges that existed when it arrived.
- **Test mode is visible**, Stripe style: a "Prueba" tag on every simulated receipt, so a screenshot
  cannot pass for a real payment.

## Getting started

Requirements: Node.js 24+ and pnpm.

```sh
pnpm install
pnpm typecheck    # needs no environment variables
pnpm test         # needs no environment variables, keys or network
```

Both run from a fresh clone with nothing else to set up. Running the app needs at least
`GROQ_API_KEY`; everything else has a default or is only needed for the real payment mode and the
agent wallet.

Create `.env` (it is git-ignored). Not `.env.local`: `eve link` and `vercel env pull` overwrite that one:

| Variable | Required | Description |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | Groq API key for the model |
| `DAILY_TOKEN_BUDGET` | no | Model tokens the public chat may spend per UTC day, shared by every visitor. Once spent, new messages get `403 daily_budget_exhausted` until the next day. Default `180000`, under Groq's free tier of 200K tokens a day. Usage is kept with the charges (`DATABASE_URL` or `DATA_DIR`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | for the wallet | WalletConnect project id from [Reown](https://dashboard.reown.com), so mobile wallets like Valora can connect. Not a secret: it ships to the browser and is restricted by the domains allowed in the dashboard |
| `PAYMENTS_MODE` | no | `simulated` (default) or `ripio` |
| `BUSINESS_ADDRESS` | with `ripio` | Celo address that receives wARS |
| `START_BLOCK` | no | With `ripio`: Celo block to start watching payments from. Default: the current block, so only new payments count |
| `APP_URL` | no | Base URL for simulated payment links. Default `http://localhost:3000` |
| `DATA_DIR` | no | Where local demo data is stored when there is no database. Default `./.data` |
| `DATABASE_URL` | on Vercel | Postgres (Neon) connection string. When set, charges and activity live there instead of `DATA_DIR`; on Vercel the app refuses to start without it. Create the tables with `pnpm db:migrate` |
| `CRON_SECRET` | for the 15-minute reconciliation | Shared secret for `POST /api/cron/reconcile`. The endpoint stays off until it is set |
| `AGENT_PRIVATE_KEY` | for the agent wallet | Key of the wallet that signs the agent's own transactions. Generate one with `node scripts/new-agent-key.ts` |
| `CELO_NETWORK` | no | Network for the agent wallet: `sepolia` (default) or `mainnet` |
| `AGENT_URI` | no | ERC-8004 registration file used by `scripts/register-agent.ts`. Default: `public/agent.json` on GitHub |

```sh
pnpm dev          # web app and agent together, on http://localhost:3000
pnpm dev:agent    # the agent alone, in eve's terminal chat
pnpm build        # production build: the agent (eve build), then the web app (next build)
pnpm start        # serve that build; Next.js starts the built agent and proxies /eve/v1/*
pnpm test         # unit and integration tests
pnpm typecheck    # TypeScript
```

## Status

Built:

- Charges with references, idempotent creation and the Ripio ramp link.
- Asking the agent about charges ("¿quién me debe?"): it reconciles first, and the count and total come
  from the code, not from the model's arithmetic.
- Reconciliation with simulated payments, file storage, the two-sided demo and receipts.
- In `ripio` mode, an on-chain reader of wARS `Transfer` events to the business address: it waits
  until a transfer's block is `safe` (Celo is an OP Stack L2: a block counts once its data is posted
  to Ethereum, a few minutes, instead of trusting the sequencer's latest block), scans only new
  blocks, and real receipts link the transaction on Celoscan.
- A read-only wallet that shows the real wARS balance.
- Brazil: a shop charges, writes down and reconciles in wBRL. The reader watches both tokens, each
  transfer takes the currency of the token that moved, and the two countries' ledgers never mix.
- i18n: typed dictionaries for es-AR, pt-BR and en, a language switcher, and an agent that answers in
  the owner's language.

- An activity log of what the agent reconciles on its own (paid, unmatched and ambiguous transfers).
  It reconciles once a day as an eve schedule (the Vercel Hobby limit), and every 15 minutes through
  a GitHub Actions workflow that calls `POST /api/cron/reconcile` with `CRON_SECRET`.
- Postgres storage (Neon) when `DATABASE_URL` is set, with the business rules enforced by the
  database too: no two pending charges share an amount, and a transfer pays one charge only.
- A public demo chat: no account needed, since the agent never moves money.
- Deployed on Vercel (Hobby) with Neon Postgres: [getowezy.vercel.app](https://getowezy.vercel.app).
- An agent wallet whose every transaction carries the ERC-8021 attribution tag, and the agent's
  ERC-8004 identity, registered on Celo Sepolia (see below).

Next:

- Registering the identity on Celo mainnet and a first real payment end to end.

Later: more countries, and paying suppliers across borders, behind explicit limits and a dedicated
wallet.

Charges never touch the agent wallet: the payer's transfer goes straight to the business address,
and the agent only creates links and reads the chain. The agent wallet signs only the agent's own
actions, such as its ERC-8004 registration.

## Onchain

The agent's identity is registered on **Celo Sepolia (testnet)**. Nothing is on mainnet yet.

| What | Value |
| --- | --- |
| Agent wallet | [`0xEA93f4D017BFF57a4E79CFC19b98BDb6CeA4f99c`](https://celo-sepolia.blockscout.com/address/0xEA93f4D017BFF57a4E79CFC19b98BDb6CeA4f99c) |
| ERC-8004 agent id | `627` |
| ERC-8004 IdentityRegistry (Sepolia) | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://celo-sepolia.blockscout.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| Registration transaction | [`0xaf5107…cdba8`](https://celo-sepolia.blockscout.com/tx/0xaf510704d7006dfabe26880e72b7020e30c8af51b393ba79e8a53e28813cdba8), its calldata ends with the ERC-8021 tag (`celo_1bc71ff8ce89`, `celo_93c87b569368`) |
| Registration file | [`public/agent.json`](public/agent.json) |
| wARS token (mainnet, read by the app) | [`0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d`](https://celoscan.io/token/0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d) |
| wBRL token (mainnet, read by the app) | [`0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0`](https://celoscan.io/token/0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0) |

To register on mainnet: fund the agent wallet with a little CELO, then
`CELO_NETWORK=mainnet node --env-file=.env scripts/register-agent.ts`. The script checks that
the transaction carries the attribution tag.
