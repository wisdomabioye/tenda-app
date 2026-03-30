import { APP_INFO } from '../../app-info'

export function Stats() {
  return (
    <section className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border-y border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-elev)_72%,transparent)] sm:border sm:bg-[color-mix(in_oklab,var(--surface)_68%,transparent)]">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {APP_INFO.stats.map((s, index) => (
              <div
                key={s.label}
                className={[
                  'px-5 py-8 text-center sm:px-8 sm:py-10',
                  index % 2 === 0 ? 'border-r border-[var(--border)] md:border-r' : '',
                  index < 2 ? 'border-b border-[var(--border)] md:border-b-0' : '',
                  index === 1 ? 'md:border-r' : '',
                  index === 2 ? 'md:border-r' : '',
                ].join(' ')}
              >
                <div className="text-3xl font-black tracking-[-0.04em] text-[var(--heading)] sm:text-4xl md:text-5xl">
                  {s.value}
                </div>
                <div className="mt-2 text-sm font-medium text-[var(--text-muted)] sm:text-base">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
