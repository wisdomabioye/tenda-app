'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/api/client'
import { buildAuthMessage, setToken, parseJwt, isAdminRole } from '@/lib/auth'

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      connect: () => Promise<{ publicKey: { toString: () => string } }>
      signMessage: (msg: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>
    }
  }
}

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    if (!window.solana) {
      toast.error('Phantom wallet not found. Please install it.')
      return
    }

    setLoading(true)
    try {
      const { publicKey } = await window.solana.connect()
      const wallet_address = publicKey.toString()

      const message   = buildAuthMessage()
      const encoded   = new TextEncoder().encode(message)
      const { signature } = await window.solana.signMessage(encoded, 'utf8')
      const signatureB58 = Buffer.from(signature).toString('base64')

      const { token } = await adminApi.auth.wallet({ wallet_address, message, signature: signatureB58 })

      const payload = parseJwt(token)
      if (!payload || !isAdminRole(payload.role)) {
        toast.error('Access denied. Admin account required.')
        return
      }

      setToken(token)
      const from = searchParams.get('from') ?? '/users'
      router.replace(from)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Tenda Admin</CardTitle>
          <CardDescription>Connect your admin wallet to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleConnect} disabled={loading}>
            {loading ? 'Connecting…' : 'Connect Wallet'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
