import { APP_INFO } from '../../app-info'

export function Stats() {
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="premium-surface overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] md:grid-cols-4 md:divide-y-0">
            {APP_INFO.stats.map((s) => (
              <div
                key={s.label}
                className="px-6 py-8 text-center sm:px-8 sm:py-10"
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
