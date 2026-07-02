import * as anchor from "@coral-xyz/anchor";
import { BN, Program, web3 } from "@coral-xyz/anchor";
import { TendaEscrow } from "../target/types/tenda_escrow";

// ── Config ────────────────────────────────────────────────────────────────────
// One-time platform initialization, run by `anchor migrate` / `anchor deploy`
// after the program is on-chain. Creates the PlatformState PDA; all values are
// mutable afterwards via the admin instructions (set_fee_bps, set_treasury, …),
// so exact-at-init is not critical — authorities are.
//
// Required env for mainnet (all three fall back to the provider wallet, which
// is acceptable ONLY on devnet):
//   TENDA_ADMIN            protocol admin — the Squads vault on mainnet (#30)
//   TENDA_DISPUTE_ADMIN    dispute authority (ops key at launch)
//   TENDA_TREASURY         fee recipient
// Optional env (defaults mirror contracts/evm/script/Deploy.s.sol and satisfy
// the on-chain ranges in programs/tenda-escrow/src/constants.rs):
//   TENDA_FEE_BPS              default 250   (2.50%)
//   TENDA_SEEKER_FEE_BPS       default 100   (1.00%, must be ≤ fee)
//   TENDA_APPROVAL_WINDOW_S    default 172800 (48h; range 1h–30d)
//   TENDA_GRACE_PERIOD_S       default 3600   (1h; range 0–14d)

const DEFAULTS = {
  feeBps: 250,
  seekerFeeBps: 100,
  approvalWindowSeconds: 172_800,
  gracePeriodSeconds: 3_600,
} as const;

function envPubkey(name: string, fallback: web3.PublicKey): web3.PublicKey {
  const raw = process.env[name];
  return raw !== undefined && raw !== "" ? new web3.PublicKey(raw) : fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer, got '${raw}'`);
  }
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);

  const program = anchor.workspace.TendaEscrow as Program<TendaEscrow>;
  const payer = provider.wallet.publicKey;

  const protocolAdmin = envPubkey("TENDA_ADMIN", payer);
  const disputeAdmin = envPubkey("TENDA_DISPUTE_ADMIN", payer);
  const treasury = envPubkey("TENDA_TREASURY", payer);
  const feeBps = envInt("TENDA_FEE_BPS", DEFAULTS.feeBps);
  const seekerFeeBps = envInt("TENDA_SEEKER_FEE_BPS", DEFAULTS.seekerFeeBps);
  const approvalWindowSeconds = envInt(
    "TENDA_APPROVAL_WINDOW_S",
    DEFAULTS.approvalWindowSeconds,
  );
  const gracePeriodSeconds = envInt(
    "TENDA_GRACE_PERIOD_S",
    DEFAULTS.gracePeriodSeconds,
  );

  if (protocolAdmin.equals(payer) || treasury.equals(payer)) {
    console.warn(
      "WARN: protocol admin/treasury defaulting to the deploy wallet — devnet only.\n" +
        "      Set TENDA_ADMIN / TENDA_DISPUTE_ADMIN / TENDA_TREASURY before mainnet.",
    );
  }

  // Derive the platform state PDA — seeds must match PLATFORM_SEED in constants.rs
  const [platformStatePda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    program.programId,
  );

  console.log("Program ID      :", program.programId.toBase58());
  console.log("Payer           :", payer.toBase58());
  console.log("Protocol admin  :", protocolAdmin.toBase58());
  console.log("Dispute admin   :", disputeAdmin.toBase58());
  console.log("Treasury        :", treasury.toBase58());
  console.log("Platform PDA    :", platformStatePda.toBase58());
  console.log("Fee             :", feeBps, "bps (seeker", seekerFeeBps, "bps)");
  console.log("Approval window :", approvalWindowSeconds, "s");
  console.log("Grace period    :", gracePeriodSeconds, "s");

  // ── Idempotency guard ──────────────────────────────────────────────────────
  // initialize_platform uses `init` which will fail if the account already
  // exists. Check first so re-running the migration gives a clear message
  // rather than a cryptic Solana error.
  const existing = await provider.connection.getAccountInfo(platformStatePda);
  if (existing !== null) {
    console.log("\nPlatform already initialized — skipping.");
    console.log(
      "To change authorities/fees/windows use the set_* admin instructions.",
    );
    return;
  }

  // ── Initialize ─────────────────────────────────────────────────────────────
  // Args struct mirrors InitializePlatformArgs (instructions/admin/
  // initialize_platform.rs); i64 fields are BN in Anchor's TypeScript types.
  const tx = await program.methods
    .initializePlatform({
      protocolAdmin,
      disputeAdmin,
      treasury,
      feeBps,
      seekerFeeBps,
      approvalWindowSeconds: new BN(approvalWindowSeconds),
      gracePeriodSeconds: new BN(gracePeriodSeconds),
    })
    .accountsPartial({
      platformState: platformStatePda,
      payer,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  console.log("\nPlatform initialized.");
  console.log("Transaction     :", tx);
};
