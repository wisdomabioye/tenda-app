/**
 * The type scale (comp lines 784-794).
 *
 * The rows are the sizes this app actually sets on its public surfaces, each
 * labelled with the spec a reader can grep for. Not every Tailwind step —
 * a scale nobody uses is a scale nobody maintains.
 */
import { FoundationsSection } from './FoundationsSection'

interface TypeRow {
  /** The mono label: what to type to get this. */
  spec: string
  className: string
  sample: string
}

const TYPE_ROWS: readonly TypeRow[] = [
  {
    spec: 'display 44/50 -1.2',
    className: 'font-display text-[44px] font-bold leading-[50px] tracking-[-1.2px]',
    sample: 'Page headline',
  },
  {
    spec: 'display 32/38 -1.2',
    className: 'font-display text-[32px] font-bold leading-[38px] tracking-[-1.2px]',
    sample: 'Headline, small screen',
  },
  {
    spec: 'display 22/28 -0.4',
    className: 'font-display text-[22px] font-semibold leading-7 tracking-[-0.4px]',
    sample: 'Section heading',
  },
  {
    spec: 'display 17/24',
    className: 'font-display text-[17px] font-semibold leading-6',
    sample: 'Card title',
  },
  { spec: 'body 17/28', className: 'text-[17px] leading-7', sample: 'Lede and article prose' },
  { spec: 'body 15/22', className: 'text-[15px] leading-[22px]', sample: 'Default body text' },
  { spec: 'body 13/18', className: 'text-[13px] leading-[18px]', sample: 'Meta and captions' },
  {
    spec: 'label 12/16 .08em',
    className: 'text-xs font-medium uppercase leading-4 tracking-[0.08em]',
    sample: 'Eyebrow label',
  },
  {
    spec: 'numeric 26/28',
    className: 'font-numeric text-[26px] font-bold leading-7 tracking-[-0.5px]',
    sample: '1,250.5',
  },
]

export function TypeScaleSection() {
  return (
    <FoundationsSection title="Type scale">
      <div className="flex flex-col gap-5">
        {TYPE_ROWS.map((row) => (
          <div
            key={row.spec}
            className="flex flex-col gap-2 border-b border-border-subtle pb-4 sm:flex-row sm:items-baseline sm:gap-8"
          >
            <span className="shrink-0 font-numeric text-xs leading-4 text-content-tertiary sm:w-[150px]">
              {row.spec}
            </span>
            <span className={`min-w-0 break-words text-content-primary ${row.className}`}>
              {row.sample}
            </span>
          </div>
        ))}
      </div>
    </FoundationsSection>
  )
}
