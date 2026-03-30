import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type BaseProps = {
  children: ReactNode
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }
type AnchorProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

type Props = ButtonProps | AnchorProps

const classes = {
  base: [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border font-semibold tracking-[-0.01em] no-underline',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
    'disabled:pointer-events-none disabled:opacity-60',
    'active:translate-y-px',
  ].join(' '),

  primary: [
    'border-[color-mix(in_oklab,var(--primary)_72%,black)]',
    'bg-[var(--primary)] text-[var(--on-primary)]',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_rgba(29,69,129,0.22)]',
    'hover:bg-[var(--primary-pressed)]',
  ].join(' '),

  outline: [
    'border-[var(--border-strong)]',
    'bg-[color-mix(in_oklab,var(--surface-strong)_96%,transparent)] text-[var(--heading)]',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
    'hover:border-[color-mix(in_oklab,var(--primary)_28%,var(--border-strong))]',
    'hover:bg-[color-mix(in_oklab,var(--surface)_92%,transparent)]',
  ].join(' '),

  ghost: [
    'border-transparent bg-transparent text-[var(--text)]',
    'hover:bg-[color-mix(in_oklab,var(--surface)_88%,transparent)]',
    'hover:text-[var(--heading)]',
  ].join(' '),

  sm: 'min-h-10 px-4 text-sm',
  md: 'min-h-11 px-5 text-sm sm:text-base',
  lg: 'min-h-12 px-6 text-base',
}

export function Button({ children, variant = 'primary', size = 'md', ...props }: Props) {
  const extra = (props as { className?: string }).className ?? ''
  const cls = `${classes.base} ${classes[variant]} ${classes[size]} ${extra}`.trim()

  if ('href' in props && props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, ...anchorProps } = props as AnchorProps
    return (
      <a {...anchorProps} className={cls}>
        {children}
      </a>
    )
  }

  const { variant: _v, size: _s, className: _c, ...btnProps } = props as ButtonProps

  return (
    <button {...btnProps} className={cls}>
      {children}
    </button>
  )
}
