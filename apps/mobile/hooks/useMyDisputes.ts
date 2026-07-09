import { useCallback, useEffect, useRef, useState } from 'react'
import type { MyDisputeRow, MyDisputeStatus } from '@tenda/shared'
import { api } from '@/api/client'

export interface MyDisputesState {
  rows: MyDisputeRow[]
  loading: boolean
  error: string | null
  /** Manual refresh (pull-to-refresh / retry). */
  reload: () => Promise<void>
}

/**
 * Loads the caller's disputes for one status bucket (open|resolved). Refetches
 * whenever `status` changes, so a segmented toggle just swaps the argument.
 * A generation guard drops superseded responses: toggling Open↔Resolved fast
 * (or a reload racing a toggle) never lets a stale batch overwrite the latest.
 */
export function useMyDisputes(status: MyDisputeStatus): MyDisputesState {
  const [rows, setRows] = useState<MyDisputeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const genRef = useRef(0)

  const load = useCallback(async () => {
    const gen = ++genRef.current
    setError(null)
    try {
      const res = await api.disputes.mine({ status })
      if (gen !== genRef.current) return // a newer request superseded this one
      setRows(res.data)
    } catch (err) {
      if (gen !== genRef.current) return
      setError(err instanceof Error ? err.message : 'Could not load your disputes')
    } finally {
      if (gen === genRef.current) setLoading(false)
    }
  }, [status])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  return { rows, loading, error, reload: load }
}
