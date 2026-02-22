import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { getConfig } from '../config'

// Must match ESCROW_SEED in constants.rs: b"escrow"
const ESCROW_SEED    = 'escrow'
const PLATFORM_SEED  = 'platform'
const USER_SEED      = 'user'

// Anchor instruction discriminators (sha256("global:<instruction_name>")[0..8])
export const DISCRIMINATOR_CREATE_ESCROW  = Buffer.from([193, 117, 69,  70,  18,  123, 67,  33 ])
export const DISCRIMINATOR_ACCEPT_GIG     = Buffer.from([94,  129, 189, 107, 220, 74,  82,  57 ])
export const DISCRIMINATOR_SUBMIT_PROOF   = Buffer.from([54,  241, 46,  84,  4,   212, 46,  94 ])
export const DISCRIMINATOR_REFUND_EXPIRED = Buffer.from([118, 153, 164, 244, 40,  128, 242, 250])
export const DISCRIMINATOR_APPROVE        = Buffer.from([191, 196, 91,  103, 232, 146, 6,   67 ])
export const DISCRIMINATOR_CANCEL_GIG     = Buffer.from([109, 142, 65,  80,  226, 145, 135, 185])

export function verifySignature(
  walletAddress: string,
  signature: string,
  message: string
): boolean {
  try {
    const publicKey = new PublicKey(walletAddress)
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = Buffer.from(signature, 'base64')

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    )
  } catch {
    return false
  }
}

/**
 * Derive the escrow PDA address for a given gig ID.
 * Seeds: [ESCROW_SEED, gig_id] — mirrors the Anchor program's PDA derivation.
 */
export function deriveEscrowAddress(gigId: string): string {
  const programId = new PublicKey(getConfig().SOLANA_PROGRAM_ID)
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(ESCROW_SEED), Buffer.from(gigId)],
    programId
  )
  return pda.toBase58()
}

/**
 * Minimal borsh encoder for create_gig_escrow instruction args.
 *  - gig_id:                    String  (u32 LE length prefix + UTF-8 bytes)
 *  - payment_amount:            u64     (8-byte LE)
 *  - completion_duration_secs:  u64     (8-byte LE)
 *  - accept_deadline:           Option<i64>  (1-byte tag + optional 8-byte LE i64)
 */
function encodeBorshCreateGigArgs(
  gigId: string,
  paymentAmount: bigint,
  completionDurationSecs: bigint,
  acceptDeadline: bigint | null,
): Buffer {
  const gigIdBytes = Buffer.from(gigId, 'utf8')

  const lenBuf = Buffer.allocUnsafe(4)
  lenBuf.writeUInt32LE(gigIdBytes.length, 0)

  const payBuf = Buffer.allocUnsafe(8)
  payBuf.writeBigUInt64LE(paymentAmount, 0)

  const durBuf = Buffer.allocUnsafe(8)
  durBuf.writeBigUInt64LE(completionDurationSecs, 0)

  if (acceptDeadline === null) {
    return Buffer.concat([lenBuf, gigIdBytes, payBuf, durBuf, Buffer.from([0])])
  }

  const tagBuf = Buffer.from([1])
  const dlBuf  = Buffer.allocUnsafe(8)
  dlBuf.writeBigInt64LE(acceptDeadline, 0)

  return Buffer.concat([lenBuf, gigIdBytes, payBuf, durBuf, tagBuf, dlBuf])
}

/**
 * Build an unsigned create_gig_escrow transaction for the client to sign.
 * The client signs and submits to Solana, then calls POST /v1/gigs/:id/publish
 * with the resulting on-chain signature.
 *
 * @param feeBps - current platform fee in basis points from getPlatformConfig(),
 *                 not the env-var default, so admin fee updates are reflected immediately.
 */
export async function buildCreateGigEscrowInstruction(
  posterAddress:              string,
  gigId:                      string,
  paymentLamports:            number,
  completionDurationSeconds:  number,
  acceptDeadline:             Date | null,
): Promise<{ transaction: string; escrow_address: string }> {
  const programId = new PublicKey(getConfig().SOLANA_PROGRAM_ID)
  const poster     = new PublicKey(posterAddress)

  const [gigEscrow]    = PublicKey.findProgramAddressSync([Buffer.from(ESCROW_SEED), Buffer.from(gigId)], programId)
  const [platformState] = PublicKey.findProgramAddressSync([Buffer.from(PLATFORM_SEED)], programId)

  const acceptDeadlineUnix = acceptDeadline
    ? BigInt(Math.floor(acceptDeadline.getTime() / 1000))
    : null

  const data = Buffer.concat([
    DISCRIMINATOR_CREATE_ESCROW,
    encodeBorshCreateGigArgs(
      gigId,
      BigInt(paymentLamports),
      BigInt(completionDurationSeconds),
      acceptDeadlineUnix,
    ),
  ])

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: gigEscrow,               isSigner: false, isWritable: true  },
      { pubkey: platformState,           isSigner: false, isWritable: true  },
      { pubkey: poster,                  isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = poster
  const { blockhash } = await getConnection().getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  return {
    transaction:    Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: gigEscrow.toBase58(),
  }
}

/**
 * Build an unsigned approve_completion transaction for the poster to sign.
 * Accounts match the Anchor IDL for approve_completion.
 * Poster signs and submits on-chain, then calls POST /v1/gigs/:id/approve with the signature.
 */
export async function buildApproveCompletionInstruction(
  posterAddress:   string,
  workerAddress:   string,
  gigId:           string,
  treasuryAddress: string,
): Promise<{ transaction: string; escrow_address: string }> {
  const programId = new PublicKey(getConfig().SOLANA_PROGRAM_ID)
  const poster     = new PublicKey(posterAddress)
  const worker     = new PublicKey(workerAddress)
  const treasury   = new PublicKey(treasuryAddress)

  const [gigEscrow]    = PublicKey.findProgramAddressSync([Buffer.from(ESCROW_SEED), Buffer.from(gigId)], programId)
  const [platformState] = PublicKey.findProgramAddressSync([Buffer.from(PLATFORM_SEED)], programId)
  const [workerAccount] = PublicKey.findProgramAddressSync([Buffer.from(USER_SEED), worker.toBuffer()], programId)

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: gigEscrow,               isSigner: false, isWritable: true  },
      { pubkey: platformState,           isSigner: false, isWritable: true  },
      { pubkey: workerAccount,           isSigner: false, isWritable: true  },
      { pubkey: poster,                  isSigner: true,  isWritable: true  },
      { pubkey: worker,                  isSigner: false, isWritable: true  },
      { pubkey: treasury,                isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATOR_APPROVE,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = poster
  const { blockhash } = await getConnection().getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  return {
    transaction:    Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: gigEscrow.toBase58(),
  }
}

/**
 * Build an unsigned cancel_gig transaction for the poster to sign.
 * Accounts match the Anchor IDL for cancel_gig.
 * Poster signs and submits on-chain, then calls DELETE /v1/gigs/:id with the signature.
 */
export async function buildCancelGigInstruction(
  posterAddress: string,
  gigId:         string,
): Promise<{ transaction: string; escrow_address: string }> {
  const programId = new PublicKey(getConfig().SOLANA_PROGRAM_ID)
  const poster    = new PublicKey(posterAddress)

  const [gigEscrow] = PublicKey.findProgramAddressSync([Buffer.from(ESCROW_SEED), Buffer.from(gigId)], programId)

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: gigEscrow,               isSigner: false, isWritable: true  },
      { pubkey: poster,                  isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATOR_CANCEL_GIG,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = poster
  const { blockhash } = await getConnection().getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  return {
    transaction:    Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: gigEscrow.toBase58(),
  }
}

/**
 * Build an unsigned accept_gig transaction for the worker to sign.
 * Accounts match the Anchor IDL for accept_gig.
 * Worker signs and submits on-chain, then calls POST /v1/gigs/:id/accept with the signature.
 */
export async function buildAcceptGigInstruction(
  workerAddress: string,
  gigId:         string,
): Promise<{ transaction: string; escrow_address: string }> {
  const programId = new PublicKey(getConfig().SOLANA_PROGRAM_ID)
  const worker    = new PublicKey(workerAddress)

  const [gigEscrow]    = PublicKey.findProgramAddressSync([Buffer.from(ESCROW_SEED), Buffer.from(gigId)], programId)
  const [workerAccount] = PublicKey.findProgramAddressSync([Buffer.from(USER_SEED), worker.toBuffer()], programId)

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: gigEscrow,    isSigner: false, isWritable: true  },
      { pubkey: workerAccount, isSigner: false, isWritable: true  },
      { pubkey: worker,        isSigner: true,  isWritable: true  },
    ],
    data: DISCRIMINATOR_ACCEPT_GIG,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = worker
  const { blockhash } = await getConnection().getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  return {
    transaction:    Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: gigEscrow.toBase58(),
  }
}

/**
 * Build an unsigned submit_proof transaction for the worker to sign.
 * Accounts match the Anchor IDL for submit_proof.
 * Worker signs and submits on-chain, then calls POST /v1/gigs/:id/submit with the signature + proofs.
 */
export async function buildSubmitProofInstruction(
  workerAddress: string,
  gigId:         string,
): Promise<{ transaction: string; escrow_address: string }> {
  const programId = new PublicKey(getConfig().SOLANA_PROGRAM_ID)
  const worker    = new PublicKey(workerAddress)

  const [gigEscrow]     = PublicKey.findProgramAddressSync([Buffer.from(ESCROW_SEED), Buffer.from(gigId)], programId)
  const [platformState] = PublicKey.findProgramAddressSync([Buffer.from(PLATFORM_SEED)], programId)

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: gigEscrow,    isSigner: false, isWritable: true  },
      { pubkey: platformState, isSigner: false, isWritable: false },
      { pubkey: worker,        isSigner: true,  isWritable: true  },
    ],
    data: DISCRIMINATOR_SUBMIT_PROOF,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = worker
  const { blockhash } = await getConnection().getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  return {
    transaction:    Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: gigEscrow.toBase58(),
  }
}

/**
 * Build an unsigned refund_expired transaction.
 * Accounts match the Anchor IDL for refund_expired.
 * The poster (fee payer) signs and submits on-chain; no signer constraint on poster in the program.
 */
export async function buildRefundExpiredInstruction(
  posterAddress: string,
  gigId:         string,
): Promise<{ transaction: string; escrow_address: string }> {
  const programId = new PublicKey(getConfig().SOLANA_PROGRAM_ID)
  const poster    = new PublicKey(posterAddress)

  const [gigEscrow]     = PublicKey.findProgramAddressSync([Buffer.from(ESCROW_SEED), Buffer.from(gigId)], programId)
  const [platformState] = PublicKey.findProgramAddressSync([Buffer.from(PLATFORM_SEED)], programId)

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: gigEscrow,               isSigner: false, isWritable: true  },
      { pubkey: platformState,           isSigner: false, isWritable: true  },
      { pubkey: poster,                  isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISCRIMINATOR_REFUND_EXPIRED,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = poster
  const { blockhash } = await getConnection().getLatestBlockhash('confirmed')
  transaction.recentBlockhash = blockhash
  return {
    transaction:    Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: gigEscrow.toBase58(),
  }
}

export function getConnection(): Connection {
  return new Connection(getConfig().SOLANA_RPC_URL, 'confirmed')
}

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
  expectedDiscriminator?: Buffer,
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

    // When a discriminator is provided, fetch the full transaction and assert
    // that it targets our program with the expected instruction type.
    // This prevents replay attacks where an attacker reuses an unrelated signature.
    if (expectedDiscriminator) {
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
        const raw = ix.data
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
