import { APP_INFO } from '../../app-info'

export function Stats() {
  return (
    <section className="py-16 px-6 bg-blue-500">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {APP_INFO.stats.map((s) => (
          <div key={s.label}>
            <div className="text-4xl font-black text-white mb-1">{s.value}</div>
            <div className="text-blue-100 text-sm font-medium">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
