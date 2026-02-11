import nacl from 'tweetnacl'
import { PublicKey, Connection, SystemProgram, Transaction } from '@solana/web3.js'

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

export function createEscrowInstruction(
  payerAddress: string,
  amount: number
) {
  const payer = new PublicKey(payerAddress)
  const escrowKeypair = PublicKey.unique()

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: escrowKeypair,
      lamports: amount,
    })
  )

  return {
    transaction: Buffer.from(transaction.serialize({ verifySignatures: false })).toString('base64'),
    escrow_address: escrowKeypair.toBase58(),
  }
}

export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
  return new Connection(rpcUrl, 'confirmed')
}
