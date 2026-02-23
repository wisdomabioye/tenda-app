import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { PublicKey, Connection, Transaction, Keypair } from '@solana/web3.js'
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor'
import IDL from '../types/tenda_escrow.json'
import type { TendaEscrow } from '../types/tenda_escrow.ts'
import { getConfig } from '../config'

const ESCROW_SEED   = 'escrow'

// ── Discriminators ───────────────────────────────────────────────────────────
type InstructionName =
  | 'create_gig_escrow'
  | 'accept_gig'
  | 'submit_proof'
  | 'approve_completion'
  | 'cancel_gig'
  | 'refund_expired'
  | 'dispute_gig'
  | 'resolve_dispute'
  | 'withdraw_earnings'
  | 'create_user_account'

function discriminatorFor(instructionName: InstructionName): Buffer {
  const ix = IDL.instructions.find((i) => i.name === instructionName)
  if (!ix) throw new Error(`Instruction '${instructionName}' not found in IDL`)
  return Buffer.from(ix.discriminator)
}

// ── Signature verification ───────────────────────────────────────────────────
export function verifySignature(
  walletAddress: string,
  signature:     string,
  message:       string,
): boolean {
  try {
    const publicKey = new PublicKey(walletAddress)
    const msgBytes  = new TextEncoder().encode(message)
    const sigBytes  = Buffer.from(signature, 'base64')
    return nacl.sign.detached.verify(msgBytes, sigBytes, publicKey.toBytes())
  } catch {
    return false
  }
}

// ── Connection singleton ─────────────────────────────────────────────────────
// One Connection per process to avoid opening a new WebSocket per request.
let _connection: Connection | undefined

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(getConfig().SOLANA_RPC_URL, 'confirmed')
  }
  return _connection
}

// ── Anchor program singleton ─────────────────────────────────────────────────
// The server builds unsigned transactions for clients to sign; it never submits
// on its own behalf. A throwaway keypair satisfies AnchorProvider's wallet
// requirement without ever being used for signing.
const _dummyWallet = new Wallet(Keypair.generate())
let _program: Program<TendaEscrow> | undefined

function getProgram(): Program<TendaEscrow> {
  if (!_program) {
    const provider = new AnchorProvider(getConnection(), _dummyWallet, {
      commitment: 'confirmed',
    })
    _program = new Program<TendaEscrow>(IDL, provider)
  }
  return _program
}

// ── PDA derivation ───────────────────────────────────────────────────────────
function escrowPda(gigId: string, programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED), Buffer.from(gigId)],
    programId,
  )[0]
}

/**
 * Derive the escrow PDA address for a given gig ID.
 * Exported for routes that need the address without building a full transaction.
 */
export function deriveEscrowAddress(gigId: string): string {
  return escrowPda(gigId, getProgram().programId).toBase58()
}

// ── Shared finaliser ─────────────────────────────────────────────────────────
// Sets feePayer + recentBlockhash and returns a base64-serialised unsigned tx.
async function finalise(tx: Transaction, feePayer: PublicKey): Promise<string> {
  tx.feePayer = feePayer
  const { blockhash } = await getConnection().getLatestBlockhash('confirmed')
  tx.recentBlockhash  = blockhash
  return Buffer.from(tx.serialize({ verifySignatures: false })).toString('base64')
}

// ── Instruction builders ─────────────────────────────────────────────────────
// Anchor handles discriminators, borsh encoding, and account ordering from the
// IDL. TypeScript errors at the call site if instruction names, arg types, or
// account names drift from the compiled program.

export async function buildCreateGigEscrowInstruction(
  posterAddress:             string,
  gigId:                     string,
  paymentLamports:           number,
  completionDurationSeconds: number,
  acceptDeadline:            Date | null,
): Promise<{ transaction: string }> {
  const program   = getProgram()
  const poster    = new PublicKey(posterAddress)

  const deadlineUnix = acceptDeadline
    ? new BN(Math.floor(acceptDeadline.getTime() / 1000))
    : null

  const tx = await program.methods
    .createGigEscrow(gigId, new BN(paymentLamports), new BN(completionDurationSeconds), deadlineUnix)
    .accounts({ poster })
    .transaction()

  return { transaction: await finalise(tx, poster) }
}

export async function buildAcceptGigInstruction(
  workerAddress: string,
  gigId:         string,
): Promise<{ transaction: string }> {
  const program   = getProgram()
  const worker    = new PublicKey(workerAddress)
  const gigEscrow = escrowPda(gigId, program.programId)

  const tx = await program.methods
    .acceptGig()
    // gigEscrow seed is gig_escrow.gig_id (own field) — circular, cannot be
    // derived without the account itself. accountsPartial overrides resolution.
    // worker_account derived from worker automatically.
    .accountsPartial({ gigEscrow, worker })
    .transaction()

  return { transaction: await finalise(tx, worker) }
}

export async function buildSubmitProofInstruction(
  workerAddress: string,
  gigId:         string,
): Promise<{ transaction: string }> {
  const program   = getProgram()
  const worker    = new PublicKey(workerAddress)
  const gigEscrow = escrowPda(gigId, program.programId)

  const tx = await program.methods
    .submitProof()
    // platform_state derived from const seeds automatically.
    .accountsPartial({ gigEscrow, worker })
    .transaction()

  return { transaction: await finalise(tx, worker) }
}

export async function buildApproveCompletionInstruction(
  posterAddress:   string,
  workerAddress:   string,
  gigId:           string,
  treasuryAddress: string,
): Promise<{ transaction: string }> {
  const program   = getProgram()
  const poster    = new PublicKey(posterAddress)
  const worker    = new PublicKey(workerAddress)
  const gigEscrow = escrowPda(gigId, program.programId)

  const tx = await program.methods
    .approveCompletion()
    // platform_state (const seeds) and worker_account (from worker) auto-resolved.
    .accountsPartial({ gigEscrow, poster, worker, treasury: new PublicKey(treasuryAddress) })
    .transaction()

  return { transaction: await finalise(tx, poster) }
}

export async function buildCancelGigInstruction(
  posterAddress: string,
  gigId:         string,
): Promise<{ transaction: string }> {
  const program   = getProgram()
  const poster    = new PublicKey(posterAddress)
  const gigEscrow = escrowPda(gigId, program.programId)

  const tx = await program.methods
    .cancelGig()
    .accountsPartial({ gigEscrow, poster })
    .transaction()

  return { transaction: await finalise(tx, poster) }
}

export async function buildRefundExpiredInstruction(
  posterAddress: string,
  gigId:         string,
): Promise<{ transaction: string }> {
  const program   = getProgram()
  const poster    = new PublicKey(posterAddress)
  const gigEscrow = escrowPda(gigId, program.programId)

  const tx = await program.methods
    .refundExpired()
    // platform_state (const seeds) auto-resolved.
    .accountsPartial({ gigEscrow, poster })
    .transaction()

  return { transaction: await finalise(tx, poster) }
}

export async function buildDisputeGigInstruction(
  initiatorAddress: string,
  gigId:            string,
  reason:           string,
): Promise<{ transaction: string }> {
  const program   = getProgram()
  const initiator = new PublicKey(initiatorAddress)
  const gigEscrow = escrowPda(gigId, program.programId)

  const tx = await program.methods
    .disputeGig(reason)
    // gig_escrow seed is circular (gig_escrow.gig_id) — must be provided explicitly.
    .accountsPartial({ gigEscrow, initiator })
    .transaction()

  return { transaction: await finalise(tx, initiator) }
}

export async function buildWithdrawEarningsInstruction(
  userAddress:    string,
  amountLamports: number,
): Promise<{ transaction: string }> {
  const program = getProgram()
  const user    = new PublicKey(userAddress)

  const tx = await program.methods
    .withdrawEarnings(new BN(amountLamports))
    // user_account PDA auto-resolved from user (seeds: [USER_SEED, user.pubkey]).
    .accounts({ user })
    .transaction()

  return { transaction: await finalise(tx, user) }
}

export async function buildCreateUserAccountInstruction(
  userAddress: string,
): Promise<{ transaction: string }> {
  const program = getProgram()
  const user    = new PublicKey(userAddress)

  const tx = await program.methods
    .createUserAccount()
    // user_account PDA auto-resolved from user (seeds: [USER_SEED, user.pubkey]).
    .accounts({ user })
    .transaction()

  return { transaction: await finalise(tx, user) }
}

// ── On-chain verification ────────────────────────────────────────────────────
/**
 * Verify that a Solana transaction signature has reached the required
 * confirmation level for the current network, and — when an expectedDiscriminator
 * is supplied — that the transaction contains at least one instruction targeting
 * the platform program with the expected action discriminator.
 *
 * devnet/testnet: accept 'confirmed' or 'finalized'
 * mainnet-beta:   require 'finalized'
 */
export async function verifyTransactionOnChain(
  signature: string,
  expectedInstruction?: InstructionName,
): Promise<{ ok: boolean; error?: string }> {
  const { SOLANA_NETWORK, SOLANA_PROGRAM_ID } = getConfig()
  const connection = getConnection()

  try {
    const result = await connection.getSignatureStatus(signature)
    const status = result.value

    if (!status) {
      return { ok: false, error: 'SIGNATURE_NOT_FINALIZED' }
    }

    if (status.err) {
      return { ok: false, error: 'SIGNATURE_VERIFICATION_FAILED' }
    }

    const { confirmationStatus } = status

    if (SOLANA_NETWORK === 'mainnet-beta') {
      if (confirmationStatus !== 'finalized') {
        return { ok: false, error: 'SIGNATURE_NOT_FINALIZED' }
      }
    } else {
      // devnet / testnet: confirmed or finalized is acceptable
      if (confirmationStatus !== 'confirmed' && confirmationStatus !== 'finalized') {
        return { ok: false, error: 'SIGNATURE_NOT_FINALIZED' }
      }
    }

    // When an instruction name is provided, fetch the full transaction and assert
    // that it targets our program with the expected instruction discriminator.
    // Discriminator is read from the IDL — no hardcoded bytes.
    // This prevents replay attacks where an attacker reuses an unrelated signature.
    if (expectedInstruction) {
      const expectedDiscriminator = discriminatorFor(expectedInstruction)
      const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 })
      if (!tx) {
        return { ok: false, error: 'SIGNATURE_VERIFICATION_FAILED' }
      }

      const programId = new PublicKey(SOLANA_PROGRAM_ID)
      // Cast to any to handle both legacy (Message) and v0 (MessageV0) message formats.
      // Legacy: message.accountKeys + message.instructions[].data (base58 string)
      // V0:     message.staticAccountKeys + message.compiledInstructions[].data (Uint8Array)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = tx.transaction.message as any
      const accountKeys: PublicKey[] = msg.staticAccountKeys ?? msg.accountKeys ?? []
      const rawInstructions: Array<{ programIdIndex: number; data: Uint8Array | string }> =
        msg.compiledInstructions ?? msg.instructions ?? []

      const hasMatchingInstruction = rawInstructions.some((ix) => {
        if (!accountKeys[ix.programIdIndex]?.equals(programId)) return false
        const raw  = ix.data
        const data = raw instanceof Uint8Array
          ? Buffer.from(raw)
          : Buffer.from(bs58.decode(raw as string))
        return data.length >= 8 && data.subarray(0, 8).equals(expectedDiscriminator)
      })

      if (!hasMatchingInstruction) {
        return { ok: false, error: 'SIGNATURE_VERIFICATION_FAILED' }
      }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'SIGNATURE_VERIFICATION_FAILED' }
  }
}
