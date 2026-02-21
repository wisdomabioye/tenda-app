import nacl from 'tweetnacl'
import { PublicKey, Connection, Transaction, SystemProgram } from '@solana/web3.js'
import { getConfig } from '../config'

// Must match ESCROW_SEED in constants.rs: b"escrow"
const ESCROW_SEED = 'escrow'

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
 * Compute the platform fee for a given payment amount.
 */
export function computePlatformFee(paymentLamports: number, feeBps: number): number {
  return Math.floor(paymentLamports * feeBps / 10_000)
}

/**
 * Build an unsigned create_gig_escrow transaction for the client to sign.
 * The client signs and submits to Solana, then calls POST /v1/gigs/:id/publish
 * with the resulting on-chain signature.
 */
export function createEscrowInstruction(
  payerAddress: string,
  gigId: string,
  paymentLamports: number,
) {
  const config = getConfig()
  const payer = new PublicKey(payerAddress)
  const escrowAddress = deriveEscrowAddress(gigId)
  const escrow = new PublicKey(escrowAddress)

  const platformFee = computePlatformFee(paymentLamports, config.PLATFORM_FEE_BPS)
  const totalLocked = paymentLamports + platformFee

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: escrow,
      lamports: totalLocked,
    })
  )

  return {
    transaction: Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: escrowAddress,
  }
}

export function getConnection(): Connection {
  return new Connection(getConfig().SOLANA_RPC_URL, 'confirmed')
}

/**
 * Verify that a Solana transaction signature has reached the required
 * confirmation level for the current network.
 *
 * devnet/testnet: accept 'confirmed' or 'finalized'
 * mainnet-beta:   require 'finalized'
 */
export async function verifyTransactionOnChain(
  signature: string,
): Promise<{ ok: boolean; error?: string }> {
  const { SOLANA_NETWORK } = getConfig()
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

    return { ok: true }
  } catch {
    return { ok: false, error: 'SIGNATURE_VERIFICATION_FAILED' }
  }
}
