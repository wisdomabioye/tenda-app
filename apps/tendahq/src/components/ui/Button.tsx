import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

type BaseProps = { children: ReactNode; variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md' | 'lg' }

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }
type AnchorProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

type Props = ButtonProps | AnchorProps

const classes = {
  base: 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 cursor-pointer no-underline',
  primary: 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25 active:scale-[0.98]',
  outline: 'border-2 border-blue-500 text-blue-500 hover:bg-blue-50 active:scale-[0.98]',
  ghost: 'text-gray-300 hover:text-white hover:bg-white/10 active:scale-[0.98]',
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
}

export function Button({ children, variant = 'primary', size = 'md', ...props }: Props) {
  const cls = `${classes.base} ${classes[variant]} ${classes[size]} ${(props as { className?: string }).className ?? ''}`

  if ('href' in props && props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, ...anchorProps } = props as AnchorProps
    return <a {...anchorProps} className={cls}>{children}</a>
  }

  const { variant: _v, size: _s, className: _c, ...btnProps } = props as ButtonProps
  return <button {...btnProps} className={cls}>{children}</button>
}
