/** Small pieces every step panel shares. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-numeric text-xs font-medium uppercase leading-4 tracking-[0.13em] text-content-tertiary">
      {children}
    </p>
  )
}

export function CharCounter({ value, max }: { value: string; max: number }) {
  return (
    <span className="self-end text-xs text-content-tertiary">
      {value.length}/{max}
    </span>
  )
}

export function FieldNote({ children }: { children: string }) {
  return <p className="text-xs leading-4 text-content-tertiary">{children}</p>
}
