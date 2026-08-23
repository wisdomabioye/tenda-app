/**
 * The detail surface's smaller parts: TakedownNotice audiences (shared copy
 * rendered to the right reader), PartyPanel's party-only visibility,
 * ApplicantList states + assign gating, and the FilePicker's MIME-derived
 * proof types.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { takedownCopy } from '@tenda/shared'
import { TakedownNotice } from '@/components/gig/detail/TakedownNotice'
import { PartyPanel } from '@/components/gig/detail/PartyPanel'
import { ApplicantList } from '@/components/gig/gig-applications'
import { FilePicker, proofTypeForFile } from '@/components/form/FilePicker'
import { CREATOR_ID, STRANGER_ID, WORKER_ID, applicant, gigDetail, userRef } from './fixtures'

test('TakedownNotice renders nothing for a visible escrow', () => {
  const { container } = render(
    <TakedownNotice escrow={gigDetail()} subject="gig" viewerId={CREATOR_ID} />,
  )
  expect(container).toBeEmptyDOMElement()
})

test('TakedownNotice speaks to each audience with the shared copy', () => {
  const hidden = gigDetail({ hidden: true, counterparty: userRef(WORKER_ID) })
  render(<TakedownNotice escrow={hidden} subject="gig" viewerId={CREATOR_ID} />)
  expect(screen.getByText(takedownCopy('owner', 'gig').title)).toBeInTheDocument()
  cleanup()
  render(<TakedownNotice escrow={hidden} subject="gig" viewerId={WORKER_ID} />)
  expect(screen.getByText(takedownCopy('counterparty', 'gig').title)).toBeInTheDocument()
  cleanup()
  render(<TakedownNotice escrow={hidden} subject="gig" viewerId={'moderator-1'} />)
  expect(screen.getByText(takedownCopy('moderator', 'gig').title)).toBeInTheDocument()
})

test('PartyPanel: the viewer-relative escrow wallet renders only when the wire carries one', () => {
  // The wire is already owner-scoped (my_signer_address), so the panel's only
  // job is honesty: show what arrived, show nothing when nothing did.
  render(
    <PartyPanel
      gig={gigDetail({ my_signer_address: 'CreatorWa11et1111111111111111111111111111' })}
      userId={CREATOR_ID}
    />,
  )
  expect(screen.getByText('Your escrow wallet')).toBeInTheDocument()
  expect(screen.getByText('Crea…1111')).toBeInTheDocument()
  cleanup()

  // Null (outsider view / draft / pre-column escrow): no row, no placeholder.
  render(<PartyPanel gig={gigDetail({ my_signer_address: null })} userId={CREATOR_ID} />)
  expect(screen.queryByText('Your escrow wallet')).toBeNull()
})

test('PartyPanel renders only for parties, with proofs and the dispute reason', () => {
  const gig = gigDetail({
    status: 'disputed',
    counterparty: userRef(WORKER_ID),
    completion_deadline: '2026-09-01T00:00:00.000Z',
    proofs: [
      {
        id: 'p1',
        escrow_id: 'escrow-1',
        url: 'https://cdn/proof.jpg',
        type: 'image',
        uploaded_at: new Date('2026-08-10T00:00:00.000Z'),
      },
    ],
    dispute: {
      id: 'd1',
      escrow_id: 'escrow-1',
      raised_by: CREATOR_ID,
      reason: 'Package never arrived',
      assigned_to: null,
      assigned_at: null,
      winner: null,
      resolved_by: null,
      resolved_at: null,
      created_at: new Date('2026-08-11T00:00:00.000Z'),
    },
  })
  const { container } = render(<PartyPanel gig={gig} userId={STRANGER_ID} />)
  expect(container).toBeEmptyDOMElement()
  cleanup()

  render(<PartyPanel gig={gig} userId={CREATOR_ID} />)
  expect(screen.getByRole('link', { name: /image proof/ })).toHaveAttribute('href', 'https://cdn/proof.jpg')
  expect(screen.getByText('Package never arrived')).toBeInTheDocument()
})

test('ApplicantList: rows offer Assign only while the gig AND the application allow it', () => {
  const rows = [
    applicant(),
    applicant({ id: 'app-2', status: 'passed', first_name: 'Lin', last_name: 'Wu' }),
  ]
  const onAssign = vi.fn()
  render(
    <ApplicantList
      applicants={rows}
      error={null}
      filter="all"
      onFilterChange={vi.fn()}
      assignable
      busy={false}
      onAssign={onAssign}
      onRetry={vi.fn()}
    />,
  )
  // One assignable row (open + unexpired), one settled row without a button.
  const buttons = screen.getAllByRole('button', { name: 'Assign this worker' })
  expect(buttons).toHaveLength(1)
  fireEvent.click(buttons[0])
  expect(onAssign).toHaveBeenCalledWith(rows[0])
  expect(screen.getByText('Not selected')).toBeInTheDocument()
})

test('ApplicantList: a non-assignable gig offers no buttons; empty + error states show', () => {
  render(
    <ApplicantList
      applicants={[applicant()]}
      error={null}
      filter="open"
      onFilterChange={vi.fn()}
      assignable={false}
      busy={false}
      onAssign={vi.fn()}
      onRetry={vi.fn()}
    />,
  )
  expect(screen.queryByRole('button', { name: 'Assign this worker' })).not.toBeInTheDocument()
  cleanup()

  render(
    <ApplicantList
      applicants={[]}
      error={null}
      filter="open"
      onFilterChange={vi.fn()}
      assignable
      busy={false}
      onAssign={vi.fn()}
      onRetry={vi.fn()}
    />,
  )
  expect(screen.getByText('Nobody waiting on you')).toBeInTheDocument()
  cleanup()

  const onRetry = vi.fn()
  render(
    <ApplicantList
      applicants={[]}
      error="Could not load applicants."
      filter="open"
      onFilterChange={vi.fn()}
      assignable
      busy={false}
      onAssign={vi.fn()}
      onRetry={onRetry}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(onRetry).toHaveBeenCalled()
})

test('proofTypeForFile derives the proof type from the MIME', () => {
  expect(proofTypeForFile(new File([], 'a.jpg', { type: 'image/png' }))).toBe('image')
  expect(proofTypeForFile(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe('video')
  expect(proofTypeForFile(new File([], 'a.pdf', { type: 'application/pdf' }))).toBe('document')
})

test('FilePicker adds typed files, removes them, and caps the batch', () => {
  const onChange = vi.fn()
  render(<FilePicker files={[]} onChange={onChange} max={2} />)
  const input = screen.getByLabelText('Choose proof files')
  fireEvent.change(input, {
    target: {
      files: [
        new File([], 'a.jpg', { type: 'image/jpeg' }),
        new File([], 'b.mp4', { type: 'video/mp4' }),
        new File([], 'c.pdf', { type: 'application/pdf' }),
      ],
    },
  })
  const picked = onChange.mock.calls[0][0] as { type: string }[]
  expect(picked).toHaveLength(2) // capped
  expect(picked.map((p) => p.type)).toEqual(['image', 'video'])
})

test('FilePicker remove buttons drop exactly one file', () => {
  const files = [
    { file: new File([], 'a.jpg', { type: 'image/jpeg' }), type: 'image' as const },
    { file: new File([], 'b.pdf', { type: 'application/pdf' }), type: 'document' as const },
  ]
  const onChange = vi.fn()
  render(<FilePicker files={files} onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Remove a.jpg' }))
  expect(onChange).toHaveBeenCalledWith([files[1]])
})
