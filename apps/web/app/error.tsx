'use client'

import { Button } from '@/components/ui'

/** Global recoverable-failure boundary (mirrors mobile's app/error.tsx role). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl font-bold text-content-primary">Something went wrong</h1>
      <p className="max-w-md text-content-secondary">
        That wasn&apos;t supposed to happen. It may be temporary — try again.
      </p>
      <Button onClick={reset} className="mt-3">
        Try again
      </Button>
    </div>
  )
}
