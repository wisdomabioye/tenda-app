/**
 * lib/escrow-proofs — the lost-response resolution (a REQUEST_TIMEOUT reads
 * back what actually persisted) and the all-or-nothing upload batch.
 */
import { beforeEach, expect, test, vi } from 'vitest'
import { ApiClientError } from '@tenda/shared'

const { addProofsMock, proofsMock, uploadMock, toastMock } = vi.hoisted(() => ({
  addProofsMock: vi.fn(),
  proofsMock: vi.fn(),
  uploadMock: vi.fn(),
  toastMock: vi.fn(),
}))
vi.mock('@/api/client', () => ({
  api: {
    escrows: {
      addProofs: (...a: unknown[]) => addProofsMock(...a),
      proofs: (...a: unknown[]) => proofsMock(...a),
    },
  },
}))
vi.mock('@/lib/uploads/upload', () => ({ uploadToCloudinary: (...a: unknown[]) => uploadMock(...a) }))
vi.mock('@/components/ui/Toast', () => ({ showToast: (...a: unknown[]) => toastMock(...a) }))

import { persistEscrowProofs, uploadProofs } from '@/lib/uploads/escrow-proofs'

const PROOFS = [{ url: 'https://cdn/a.jpg', type: 'image' as const }]

beforeEach(() => {
  addProofsMock.mockResolvedValue({})
  uploadMock.mockResolvedValue('https://cdn/a.jpg')
})

test('persists via addProofs on the happy path', async () => {
  await persistEscrowProofs('e1', PROOFS)
  expect(addProofsMock).toHaveBeenCalledWith({ id: 'e1' }, { proofs: PROOFS })
  expect(proofsMock).not.toHaveBeenCalled()
})

test('a REQUEST_TIMEOUT resolves by reading back — success when everything persisted', async () => {
  addProofsMock.mockRejectedValue(new ApiClientError(408, 'Timeout', 'slow', 'REQUEST_TIMEOUT'))
  proofsMock.mockResolvedValue(PROOFS)
  await persistEscrowProofs('e1', PROOFS)
})

test('a REQUEST_TIMEOUT with rows missing still fails', async () => {
  addProofsMock.mockRejectedValue(new ApiClientError(408, 'Timeout', 'slow', 'REQUEST_TIMEOUT'))
  proofsMock.mockResolvedValue([])
  await expect(persistEscrowProofs('e1', PROOFS)).rejects.toThrow('slow')
})

test('other failures rethrow without a read-back', async () => {
  addProofsMock.mockRejectedValue(new ApiClientError(500, 'Internal', 'boom', 'INTERNAL_ERROR'))
  await expect(persistEscrowProofs('e1', PROOFS)).rejects.toThrow('boom')
  expect(proofsMock).not.toHaveBeenCalled()
})

test('uploadProofs uploads in order and returns the proof list', async () => {
  uploadMock.mockResolvedValueOnce('https://cdn/1.jpg').mockResolvedValueOnce('https://cdn/2.pdf')
  const files = [
    { file: new File(['a'], 'a.jpg', { type: 'image/jpeg' }), type: 'image' as const },
    { file: new File(['b'], 'b.pdf', { type: 'application/pdf' }), type: 'document' as const },
  ]
  await expect(uploadProofs(files)).resolves.toEqual([
    { url: 'https://cdn/1.jpg', type: 'image' },
    { url: 'https://cdn/2.pdf', type: 'document' },
  ])
})

test('one failed upload voids the whole batch with a named toast', async () => {
  uploadMock.mockResolvedValueOnce('https://cdn/1.jpg').mockRejectedValueOnce(new Error('too big'))
  const files = [
    { file: new File(['a'], 'a.jpg', { type: 'image/jpeg' }), type: 'image' as const },
    { file: new File(['b'], 'b.pdf', { type: 'application/pdf' }), type: 'document' as const },
  ]
  await expect(uploadProofs(files)).resolves.toBeNull()
  expect(toastMock).toHaveBeenCalledWith('error', expect.stringContaining('b.pdf'))
})
