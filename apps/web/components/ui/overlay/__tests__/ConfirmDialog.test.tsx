/** ConfirmDialog: render gating, Escape + backdrop cancel, busy lockout. */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '@/components/ui'

function setup(over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      open
      title="Unlink wallet"
      message="Sure?"
      confirmLabel="Unlink"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    />,
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog open={false} title="T" confirmLabel="Go" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('confirms and cancels through the buttons', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Unlink' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Escape and a backdrop click both cancel; a click INSIDE does not', async () => {
    const { onCancel } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('presentation'))
    expect(onCancel).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByText('Sure?'))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('busy disables both buttons and swaps the confirm label', () => {
    setup({ busy: true })
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('busy locks EVERY way out — Escape and the backdrop stop cancelling too', async () => {
    // The Cancel button is disabled while busy; letting Escape/backdrop slip
    // through would tear the dialog down mid-operation.
    const { onCancel } = setup({ busy: true })
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('presentation'))
    expect(onCancel).not.toHaveBeenCalled()
  })
})
