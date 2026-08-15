import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * The ONE source of button styling — <Button> for real buttons, and
 * `buttonVariants()` as the className for links that look like buttons
 * (Next's <Link> stays a real anchor for semantics and prefetching).
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-solid text-brand-on-primary hover:bg-brand-primary-pressed disabled:bg-control-disabled-background disabled:text-control-disabled-text',
        outline:
          'border border-border-default text-content-secondary hover:border-border-strong hover:text-content-primary disabled:border-control-disabled-border disabled:text-control-disabled-text',
        ghost: 'text-content-secondary hover:text-content-primary disabled:text-control-disabled-text',
      },
      size: {
        md: 'px-5 py-2 text-sm',
        lg: 'px-6 py-3',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'lg' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, fullWidth, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  )
}
