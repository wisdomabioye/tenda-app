/**
 * The input dialogs: proof-upload gating over the REAL shared
 * missingProofTypes, the dispute reason gate + bond note, the review score
 * gate, the apply obligation, and the off-chain draft delete.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { APPLY_OBLIGATION } from '@tenda/shared'

const { uploadProofsMock, toastMock, reviewMock, deleteMock, pushMock } = vi.hoisted(() => ({
  uploadProofsMock: vi.fn(),
  toastMock: vi.fn(),
  reviewMock: vi.fn(),
  deleteMock: vi.fn(),
  pushMock: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock('@/components/ui/Toast', () => ({ showToast: (...a: unknown[]) => toastMock(...a) }))
vi.mock('@/lib/uploads/escrow-proofs', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@/lib/uploads/escrow-proofs')),
  uploadProofs: (...a: unknown[]) => uploadProofsMock(...a),
}))
vi.mock('@/stores/gigs.store', () => ({
  useGigsStore: (selector: (s: { reviewEscrow: typeof reviewMock }) => unknown) =>
    selector({ reviewEscrow: reviewMock }),
}))
vi.mock('@/api/client', () => ({
  api: { escrows: { delete: (...a: unknown[]) => deleteMock(...a) } },
}))

import { ProofUploadDialog } from '@/components/gig/detail/ProofUploadDialog'
import { DisputeDialog, GigActionDialogs, ReviewDialog } from '@/components/gig/detail/action-dialogs'
import { ApplyDialog } from '@/components/gig/gig-applications'

function pickFile(name: string, type: string) {
  const input = screen.getByLabelText('Choose proof files')
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type })] } })
}

beforeEach(() => {
  uploadProofsMock.mockResolvedValue([{ url: 'https://cdn/a.jpg', type: 'image' }])
  reviewMock.mockResolvedValue(undefined)
  deleteMock.mockResolvedValue({ deleted: true })
})

describe('ProofUploadDialog', () => {
  test('requirements gate the submit until every required type is covered', () => {
    const onSubmit = vi.fn()
    render(
      <ProofUploadDialog
        open
        onClose={vi.fn()}
        title="Submit proof"
        submitLabel="Submit"
        closeMode="before-submit"
        requirements={['image', 'video']}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText(/Still missing: photo, video/i)).toBeInTheDocument()
    pickFile('a.jpg', 'image/jpeg')
    expect(screen.getByText(/Still missing: video/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    pickFile('b.mp4', 'video/mp4')
    expect(screen.getByText(/All requirements covered/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
  })

  test('already-attached proofs count toward the requirement (retry after a failed tx)', () => {
    render(
      <ProofUploadDialog
        open
        onClose={vi.fn()}
        title="Submit proof"
        submitLabel="Submit"
        closeMode="before-submit"
        requirements={['image']}
        alreadyAttached={[{ type: 'image' }]}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByText(/All requirements covered/)).toBeInTheDocument()
  })

  test('before-submit mode closes as soon as the upload lands, then hands off', async () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn(async () => true)
    render(
      <ProofUploadDialog
        open
        onClose={onClose}
        title="Submit proof"
        submitLabel="Submit"
        closeMode="before-submit"
        onSubmit={onSubmit}
      />,
    )
    pickFile('a.jpg', 'image/jpeg')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ url: 'https://cdn/a.jpg', type: 'image' }]))
    expect(onClose).toHaveBeenCalled()
  })

  test('a failed upload keeps the dialog open and never hands off', async () => {
    uploadProofsMock.mockResolvedValue(null) // failure already toasted inside
    const onClose = vi.fn()
    const onSubmit = vi.fn()
    render(
      <ProofUploadDialog
        open
        onClose={onClose}
        title="Submit proof"
        submitLabel="Submit"
        closeMode="before-submit"
        onSubmit={onSubmit}
      />,
    )
    pickFile('a.jpg', 'image/jpeg')
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(uploadProofsMock).toHaveBeenCalled())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('DisputeDialog', () => {
  test('gates on a non-empty reason and names the bond', async () => {
    const onDisputeReady = vi.fn(async () => true)
    render(<DisputeDialog open onClose={vi.fn()} bondLabel="5 USDC" onDisputeReady={onDisputeReady} />)
    expect(screen.getByText(/5 USDC bond is locked/)).toBeInTheDocument()
    const raise = screen.getByRole('button', { name: 'Raise Dispute' })
    expect(raise).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/), { target: { value: '  late  ' } })
    fireEvent.click(raise)
    await waitFor(() => expect(onDisputeReady).toHaveBeenCalledWith('late'))
  })

  test('without a bond the note still promises the wallet, not a charge', () => {
    render(<DisputeDialog open onClose={vi.fn()} onDisputeReady={vi.fn()} />)
    expect(screen.getByText(/wallet will open to approve/)).toBeInTheDocument()
    expect(screen.queryByText(/bond/)).not.toBeInTheDocument()
  })
})

describe('ReviewDialog', () => {
  test('gates on a score, submits through the store, toasts and notifies', async () => {
    const onReviewSubmitted = vi.fn()
    render(
      <ReviewDialog open onClose={vi.fn()} escrowId="e1" onReviewSubmitted={onReviewSubmitted} />,
    )
    const submit = screen.getByRole('button', { name: 'Submit Review' })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    fireEvent.change(screen.getByPlaceholderText(/Share your experience/), { target: { value: 'great' } })
    fireEvent.click(submit)
    await waitFor(() => expect(reviewMock).toHaveBeenCalledWith('e1', { score: 4, comment: 'great' }))
    expect(onReviewSubmitted).toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith('success', 'Review submitted!')
  })
})

describe('ApplyDialog', () => {
  test('states the obligation, trims the pitch to null, closes on success', async () => {
    const onSubmit = vi.fn(async () => true)
    const onClose = vi.fn()
    render(<ApplyDialog open busy={false} onClose={onClose} onSubmit={onSubmit} />)
    expect(screen.getByText(APPLY_OBLIGATION)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/good fit/), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(null))
    expect(onClose).toHaveBeenCalled()
  })

  test('stays open when the application is refused', async () => {
    const onSubmit = vi.fn(async () => false)
    const onClose = vi.fn()
    render(<ApplyDialog open busy={false} onClose={onClose} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('GigActionDialogs — delete draft', () => {
  const GIG = { escrow_id: 'e1', dispute_bond_raw: '0', asset: 'USDC_SOL' }

  test('the confirm deletes off-chain and lands on My Gigs', async () => {
    render(
      <GigActionDialogs
        gig={GIG}
        activeSheet="delete"
        onClose={vi.fn()}
        onReviewSubmitted={vi.fn()}
        onProofsReady={vi.fn()}
        onAddProofsReady={vi.fn()}
        onDisputeReady={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith({ id: 'e1' }))
    expect(toastMock).toHaveBeenCalledWith('success', 'Draft deleted')
    expect(pushMock).toHaveBeenCalledWith('/my-gigs')
  })

  test('cancel never deletes', () => {
    const onClose = vi.fn()
    render(
      <GigActionDialogs
        gig={GIG}
        activeSheet="delete"
        onClose={onClose}
        onReviewSubmitted={vi.fn()}
        onProofsReady={vi.fn()}
        onAddProofsReady={vi.fn()}
        onDisputeReady={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteMock).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
