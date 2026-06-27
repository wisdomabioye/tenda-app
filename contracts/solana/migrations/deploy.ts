import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { TendaEscrow } from "../target/types/tenda_escrow";

// ── Config ────────────────────────────────────────────────────────────────────
// Matches the on-chain constants in constants.rs
const PLATFORM_FEE_BPS = 250; // 2.5%
const GRACE_PERIOD_SECS = 86_400; // 24 hours

// Treasury receives platform fees. Override via TREASURY_ADDRESS env var.
// Falls back to the admin wallet (deploy wallet) — fine for devnet,
// We must set a dedicated treasury address before mainnet.
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS ?? null;

// ─────────────────────────────────────────────────────────────────────────────

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);

  const program = anchor.workspace.TendaEscrow as Program<TendaEscrow>;
  const admin = provider.wallet.publicKey;

  const treasury = TREASURY_ADDRESS
    ? new web3.PublicKey(TREASURY_ADDRESS)
    : admin; // devnet fallback

  // Derive the platform state PDA — seeds must match PLATFORM_SEED in constants.rs
  const [platformStatePda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    program.programId,
  );

  console.log("Program ID    :", program.programId.toBase58());
  console.log("Admin         :", admin.toBase58());
  console.log("Treasury      :", treasury.toBase58());
  console.log("Platform PDA  :", platformStatePda.toBase58());
  console.log("Fee           :", PLATFORM_FEE_BPS, "bps");
  console.log("Grace period  :", GRACE_PERIOD_SECS, "s");

  // ── Idempotency guard ──────────────────────────────────────────────────────
  // initialize_platform uses `init` which will fail if the account already
  // exists. Check first so re-running the migration gives a clear message
  // rather than a cryptic Solana error.
  const existing = await provider.connection.getAccountInfo(platformStatePda);
  if (existing !== null) {
    console.log("\nPlatform already initialized — skipping.");
    console.log(
      "To change fee or grace period use the admin update instruction.",
    );
    return;
  }

  // ── Initialize ─────────────────────────────────────────────────────────────
  // grace_period_seconds is i64 on-chain → BN in Anchor's TypeScript types.
  // Anchor 0.30+ auto-resolves PDAs with known seeds (platform_state) and
  // standard programs (system_program), so only pass accounts it can't derive.
  const tx = await program.methods
    .initializePlatform(PLATFORM_FEE_BPS, new anchor.BN(GRACE_PERIOD_SECS))
    .accounts({ admin, treasury })
    .rpc();

  console.log("\nPlatform initialized.");
  console.log("Transaction   :", tx);
};
