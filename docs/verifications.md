# Verifications: sme-treasury-agent

Gate for the specs. See `openspec/changes/sme-treasury-agent/proposal.md`.
Each item: `confirmed` / `refuted` / `blocked` / `pending`, with evidence and date.

| # | Question | Status | Date |
|---|---|---|---|
| V1 | Ramp link with third-party `address` delivers wARS? KYC, time | pending (owner) | — |
| V2 | Amount received equals amount charged? | pending (owner) | — |
| V3 | eve tool can import a workspace package; Node 24 required? | **confirmed** (build level) | 2026-10-16 |
| V4 | wARS deployed on a Celo testnet? | **refuted** (no evidence of deployment) | 2026-10-16 |
| V5 | Textile quote/execution wARS → USD₮ → wBRL for a non-filler | pending (phase 2 only) | — |
| V6 | Ripio ramp for Brazil takes `country=BR&token=WBRL` and delivers wBRL to a third-party `address` | pending (owner) | — |
| V7 | wBRL on Celo mainnet is `0xd76f5faf6888e24d9f04bf92a0c8b921fe4390e0` | **confirmed**: forno `eth_call` gives `symbol()` = "wBRL" and `decimals()` = 18; the address matches docs.celo.org "Stablecoin Contracts" | 2026-11-04 |

---

## V3: eve + workspace package (confirmed at build level)

**Method.** Throwaway probe outside the repo (session scratchpad):

- pnpm workspace with `apps/*` and `packages/*`.
- `packages/domain` named `@probe/domain`, `"type": "module"`, `exports: { "./charge": "./src/charge.ts" }`
  pointing at **TypeScript source** (no build step for the package).
- `apps/agent` created with `npx eve@latest init agent -n`, then `pnpm --filter agent add @probe/domain@workspace:*`.
- Tool `agent/tools/settle_charge.ts` importing `settle` and a marker constant from `@probe/domain/charge`.

**Evidence.**

- `pnpm exec tsc` in `apps/agent`: exit 0 (scaffold uses `moduleResolution: "bundler"`).
- `pnpm exec eve build --skip-sandbox-prewarm`: success (eve 0.79.1, rolldown + Nitro).
- The domain code is **inlined** in `.output/server/_chunks/node-server.mjs` (`DOMAIN_MARKER` and `settle` found).
- eve docs: "During `eve dev`, ordinary dependencies are bundled into each retained runtime generation"
  (`build.externalDependencies` opts out). Workspace extensions are documented separately and are not needed for a
  plain library package.

**Node.** eve docs, Getting Started: "Node.js 24 or newer". Local machine: Node v26.3.0, pnpm 12.10.1. The scaffold
does not write `engines`; it uses `@types/node: 24.x` and `typescript: 7.0.2`. We should declare `engines.node >= 24`.

**Not verified.** Executing the tool at runtime through `eve dev` (it needs a model credential). Bundled output is
strong evidence, but the first real tool in the repo should be exercised end to end.

**Gotcha found: pnpm 12 `minimumReleaseAge`.** The first install failed with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`:
`eve init` resolved `eve@0.80.0` and `ai@7.0.142`, published less than 24 h earlier. Fix without relaxing the
policy: pin `eve` to `0.79.1`, delete the lockfile, reinstall (fresh resolution picks versions older than the cutoff).
Rule for the repo: pin eve to an exact version and keep the supply-chain policy on.

**Implication for the layout.** eve bundles imported application code. The project later moved to a single package
(feature-based, `src/features/*`), where `agent/tools` import features via `#features/*` subpath imports.

## V4: wARS on a Celo testnet (refuted)

**Evidence.**

- Celo Sepolia RPC `https://forno.celo-sepolia.celo-testnet.org` (chainId `0xaa044c` = 11142220):
  `eth_getCode(0x0dc4f92879b7670e5f4e4e6e3c801d229129d90d)` = `0x` → no contract at the mainnet address.
- Same call on mainnet `https://forno.celo.org` (chainId `0xa4ec` = 42220) returns EIP-1967 proxy bytecode.
- Alfajores RPC did not respond (network deprecated).
- Celo Sepolia Blockscout search for "wARS", "Wrapped ARS", "Ripio": no Ripio token (only unrelated hits).
- Web search: launch coverage describes mainnet only; no testnet address published.

**Caveat.** This proves absence at the mainnet address and absence of evidence elsewhere, not that no testnet
deployment exists. Asking Ripio would settle it.

**Implication for testing.**

1. Feature `domain/` folders and `src/core`: unit tests with no chain at all (TDD core), so most tests are unaffected.
2. Chain adapter (read `Transfer` events): tests against **recorded mainnet fixtures** (real logs saved as JSON) and/or a
   **local fork of Celo mainnet** (e.g. anvil `--fork-url`), read-only, no keys.
3. A mock ERC-20 on Celo Sepolia would need a deployer key (testnet, no real value). This is optional and the
   owner decides.
