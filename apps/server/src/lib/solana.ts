import nacl from 'tweetnacl'
import { PublicKey, Connection, Transaction, SystemProgram } from '@solana/web3.js'

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
  const programId = new PublicKey(
    process.env.SOLANA_PROGRAM_ID ?? 'TendaEscrowProgram1111111111111111111111111'
  )
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
  const payer = new PublicKey(payerAddress)
  const escrowAddress = deriveEscrowAddress(gigId)
  const escrow = new PublicKey(escrowAddress)

  const feeBps = Number(process.env.PLATFORM_FEE_BPS ?? 250)
  const platformFee = computePlatformFee(paymentLamports, feeBps)
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
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
  return new Connection(rpcUrl, 'confirmed')
}
