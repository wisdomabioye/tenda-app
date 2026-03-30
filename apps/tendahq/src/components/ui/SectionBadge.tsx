export function SectionBadge({ children }: { children: string }) {
  return (
    <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase text-[var(--primary)] bg-[var(--primary-tint)] border border-[color-mix(in_oklab,var(--primary)_28%,transparent)] rounded-full mb-4">
      {children}
    </span>
  )
}
