# TendaEscrow — EVM deploy runbook (BASE / CELO)

Status at time of writing: **contract code-complete, never deployed.** `forge build`
+ `forge test` are green (31/31), `forge` 1.7.1 is installed, `lib/` deps present.
No `broadcast/` artifacts exist — nothing is on-chain on any network. The server
adapter is written but dormant (no `CHAIN_EIP155_*` env vars are set, so the
secrets loader (`apps/server/src/chains/secrets.ts`) activates Solana only).

This runbook covers BASE (eip155:8453). CELO (eip155:42220) is identical — swap the
`BASE_` prefixes for `CELO_` and the chain-specific addresses.

---

## 0. Prerequisites (the open #47 / #49 external work — do these FIRST)

These are gating and **not yet done**. The deploy cannot be trusted-for-production
until they are:

| Item | Produces | Needed for |
|---|---|---|
| **Safe 3-of-5 multisig on BASE** | the Safe address | `TENDA_ADMIN` + `TENDA_TREASURY` (constructor) and `CHAIN_EIP155_8453_TREASURY_ADDR` (server) |
| **Dispute-authority key** (ops key at launch, can migrate to its own Safe) | `TENDA_DISPUTE_ADMIN` | constructor |
| **Alchemy account** (BASE app) | `CHAIN_EIP155_8453_RPC_URL`, `CHAIN_EIP155_8453_WEBHOOK_SECRET` | server adapter + event ingest |
| **Coinbase paymaster** (BASE) | `CHAIN_EIP155_8453_PAYMASTER_URL` | gasless UserOps (mobile #46) |
| **Solidity audit** | sign-off | mainnet only |
| **Deployer EOA** funded with ETH on BASE | `DEPLOYER_KEY` | broadcasting the deploy tx |
| **Basescan API key** | `--etherscan-api-key` | source verification |

> Do a full dress rehearsal on **Base Sepolia (eip155:84532)** before mainnet. Same
> steps, throwaway addresses, free testnet ETH from a faucet.

---

## 1. Pre-flight (in `contracts/evm/`)

```bash
cd contracts/evm
forge build          # must compile (solc 0.8.35, via_ir)
forge test           # must be 31/31 green
forge fmt --check     # style gate
```

---

## 2. Resolve the constructor inputs

The deploy script (`script/Deploy.s.sol`) reads these from the environment:

**Required (no defaults — deploy reverts on `address(0)`):**

| Env var | Value |
|---|---|
| `TENDA_ADMIN` | the Safe 3-of-5 address (protocol admin **and** the natural treasury owner) |
| `TENDA_DISPUTE_ADMIN` | separate dispute authority (ops key at launch) |
| `TENDA_TREASURY` | fee recipient — normally the same Safe as `TENDA_ADMIN` |

**Optional (defaults mirror the Solana platform config — keep them unless product says otherwise):**

| Env var | Default | Meaning |
|---|---|---|
| `TENDA_FEE_BPS` | `250` | 2.50% platform fee |
| `TENDA_SEEKER_FEE_BPS` | `100` | 1.00% reduced seeker fee |
| `TENDA_APPROVAL_WINDOW_S` | `172800` | 48h poster review window |
| `TENDA_GRACE_PERIOD_S` | `3600` | 1h grace period |

> These four are validated on-chain (`_validateFeeBps`, `_validateApprovalWindow`,
> `_validateGracePeriod`). They are also mutable post-deploy via the admin (Safe)
> setters, so getting them exactly right at deploy time is not critical.

**Token addresses (for step 5, not the constructor — the contract is asset-agnostic):**

| Network | USDC (`BASE_USDC_ADDR`) |
|---|---|
| BASE mainnet (8453) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia (84532) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

> ⚠️ Verify both against Circle's official docs before use — a wrong token address
> silently routes funds to the wrong contract.

---

## 3. Deploy

```bash
export TENDA_ADMIN=0x...           # Safe 3-of-5
export TENDA_DISPUTE_ADMIN=0x...   # ops key
export TENDA_TREASURY=0x...        # = Safe, usually
export DEPLOYER_KEY=0x...          # funded EOA private key (NOT a Safe)
export BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
export BASESCAN_API_KEY=...

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify --etherscan-api-key "$BASESCAN_API_KEY" \
  --private-key "$DEPLOYER_KEY"
```

The script logs `TendaEscrow deployed: 0x...` — **that address is
`CHAIN_EIP155_8453_ESCROW_ADDR`.**
Foundry also writes `broadcast/Deploy.s.sol/8453/run-latest.json` (commit-worthy
deployment record) and the verified source on Basescan.

> The deployer EOA only constructs the contract; it holds **no** privileged role
> afterward. All authority sits with `TENDA_ADMIN` (the Safe) and
> `TENDA_DISPUTE_ADMIN`. There is nothing to renounce.

---

## 4. Post-deploy sanity checks (read-only)

```bash
cast call $BASE_ESCROW_ADDR "admin()(address)"        --rpc-url $BASE_RPC_URL  # == Safe
cast call $BASE_ESCROW_ADDR "disputeAdmin()(address)" --rpc-url $BASE_RPC_URL
cast call $BASE_ESCROW_ADDR "treasury()(address)"     --rpc-url $BASE_RPC_URL
cast call $BASE_ESCROW_ADDR "feeBps()(uint16)"        --rpc-url $BASE_RPC_URL  # 250
```

---

## 5. Wire the server (`apps/server/.env`)

Chain secrets are flat env vars keyed by CAIP-2 id — `CHAIN_<SANITISED_ID>_<FIELD>`,
loaded and validated by `apps/server/src/chains/secrets.ts`. Activation rule:
**none set → chain inactive (silently skipped); all three required set → active;
some-but-not-all, or any malformed value → boot error naming the exact key.**
At most one chain per family may be active (BASE mainnet XOR Base Sepolia).

```dotenv
# required (all three, or partial-config boot error)
CHAIN_EIP155_8453_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
CHAIN_EIP155_8453_ESCROW_ADDR=0x...     # from step 3 deploy output
CHAIN_EIP155_8453_TREASURY_ADDR=0x...   # the Safe (treasury_address in the chain row)
# optional
CHAIN_EIP155_8453_PAYMASTER_URL=https://...   # unset = no gasless UserOps (users pay gas)
CHAIN_EIP155_8453_WEBHOOK_SECRET=...          # HMAC signing key from the Alchemy webhook
```

USDC is **not** an env var — the token address is a manifest constant
(`packages/shared/src/chains/manifest.ts`, `USDC_BASE`), seeded from there.

Then seed the chain + asset registry rows (USDC_BASE + ETH_BASE):

```bash
cd apps/server
pnpm db:seed           # idempotent (src/db/seed-v2.ts); inserts eip155:8453 chain row + assets
```

Restart the server. On boot the registry now mounts the BASE adapter.

---

## 6. Event ingestion — Alchemy webhook

Create an Alchemy **Custom Webhook** (or Address Activity) on the BASE app pointed at:

```
POST https://<server-host>/v1/webhooks/alchemy
```

- Watch address: the deployed escrow (`CHAIN_EIP155_8453_ESCROW_ADDR`).
- The signing key Alchemy generates is `CHAIN_EIP155_8453_WEBHOOK_SECRET`; the route
  verifies the HMAC (`src/core/webhooks/verify-hmac.ts`) and drops unsigned/mismatched
  calls.
- This is the push path that confirms on-chain escrow events; the client-ping
  (`POST /v1/blockchain/transaction`) + BullMQ verify-tx job is the pull fallback.

---

## 7. End-to-end smoke (testnet first)

1. Mobile: pick BASE as the chain in gig-create, fund a test wallet with Sepolia
   USDC + ETH.
2. Create → accept → submit → approve → claim a full escrow lifecycle.
3. Confirm each transition emits the expected event (`EscrowCreated`,
   `EscrowAccepted`, `ProofSubmitted`, `EscrowApproved`, `PaymentClaimed`) and that
   the server's verify-tx job + WS republish reflect it.
4. Confirm fee math: `treasury` receives `feeBps`/`seekerFeeBps` of principal.

---

## 8. CELO (eip155:42220) — deltas only

Same flow, with: `CHAIN_EIP155_42220_RPC_URL`, `CHAIN_EIP155_42220_ESCROW_ADDR`,
`CHAIN_EIP155_42220_TREASURY_ADDR`. CELO uses `feeCurrency=cUSD` on every tx (no
paymaster, no UserOp counter — token addresses are canonical mainnet constants in
the shared `CHAIN_MANIFEST`). Confirmation margin is shorter. No
`CHAIN_EIP155_42220_PAYMASTER_URL` needed.

---

## Rollback / kill-switch

There is no contract-level pause. To take EVM offline operationally, unset **all**
`CHAIN_EIP155_8453_*` vars (a partial unset is a boot error) and restart the server —
the adapter stops registering and `eip155:8453` requests fail closed with
`no adapter registered for chain_id 'eip155:8453'`. Funds already in escrows remain
claimable directly on-chain via the Safe.
