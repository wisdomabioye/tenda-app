'use client'

/**
 * Completion-window picker — web port of mobile's DurationPicker: preset
 * chips + a Custom chip revealing a numeric input with a day/hour unit
 * toggle. Same presets, same seconds arithmetic.
 */
import { useState } from 'react'
import { Chip } from '@/components/ui/Chip'
import { controlClassName } from '@/components/ui/TextField'

const PRESETS: { label: string; seconds: number }[] = [
  { label: '1d', seconds: 86_400 },
  { label: '3d', seconds: 259_200 },
  { label: '7d', seconds: 604_800 },
  { label: '14d', seconds: 1_209_600 },
  { label: '30d', seconds: 2_592_000 },
]

export function DurationPicker({
  label = 'Completion window',
  helper = 'How long the worker has after accepting.',
  value,
  onChange,
}: {
  label?: string
  helper?: string
  value: number
  onChange: (seconds: number) => void
}) {
  const isPreset = PRESETS.some((p) => p.seconds === value)
  const [customMode, setCustomMode] = useState(!isPreset && value > 0)
  const [customNum, setCustomNum] = useState(isPreset ? '' : String(Math.round(value / 86_400)))
  const [unit, setUnit] = useState<'hours' | 'days'>('days')

  function selectPreset(seconds: number) {
    setCustomMode(false)
    onChange(seconds)
  }

  function handleCustomChange(val: string) {
    setCustomNum(val)
    const n = parseInt(val, 10)
    if (n > 0) onChange(n * (unit === 'days' ? 86_400 : 3_600))
  }

  function toggleUnit() {
    const next = unit === 'days' ? 'hours' : 'days'
    setUnit(next)
    const n = parseInt(customNum, 10)
    if (n > 0) onChange(n * (next === 'days' ? 86_400 : 3_600))
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-content-primary">{label}</p>
      <p className="-mt-1 text-xs text-content-tertiary">{helper}</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            selected={!customMode && value === p.seconds}
            onClick={() => selectPreset(p.seconds)}
          />
        ))}
        <Chip label="Custom" selected={customMode} onClick={() => setCustomMode(true)} />
      </div>
      {customMode && (
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={customNum}
            aria-label={`Custom duration in ${unit}`}
            onChange={(e) => handleCustomChange(e.target.value)}
            className={`${controlClassName} max-w-28`}
          />
          <button
            type="button"
            onClick={toggleUnit}
            className="rounded-control border border-border-default px-3 py-2 text-sm text-content-secondary"
          >
            {unit}
          </button>
        </div>
      )}
    </div>
  )
}
