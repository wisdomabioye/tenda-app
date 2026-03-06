export function SectionBadge({ children }: { children: string }) {
  return (
    <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase text-blue-500 bg-blue-50 rounded-full mb-4">
      {children}
    </span>
  )
}
