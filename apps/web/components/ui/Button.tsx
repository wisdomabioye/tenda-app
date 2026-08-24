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
      // Mobile's variant vocabulary (apps/mobile/components/ui/Button.tsx),
      // spec-correction #44: primary carries the brand-tinted fab shadow,
      // secondary is a FILLED inset step between primary and outline, danger
      // is SOLID for destructive commits, danger-outline stays for the
      // restrained destructive entry points (wallet intent cancel).
      variant: {
        primary:
          'bg-brand-solid text-brand-on-primary shadow-fab hover:bg-brand-primary-pressed disabled:bg-control-disabled-background disabled:text-control-disabled-text disabled:shadow-none',
        secondary:
          'bg-surface-inset text-content-primary hover:bg-surface-inset/70 disabled:bg-control-disabled-background disabled:text-control-disabled-text',
        outline:
          'border-[1.5px] border-border-default text-content-primary hover:border-border-strong disabled:border-control-disabled-border disabled:text-control-disabled-text',
        danger:
          'bg-feedback-danger-solid text-brand-on-primary hover:bg-feedback-danger-solid/90 disabled:bg-control-disabled-background disabled:text-control-disabled-text',
        'danger-outline':
          'border-[1.5px] border-feedback-danger-base/50 text-feedback-danger-base hover:border-feedback-danger-base disabled:border-control-disabled-border disabled:text-control-disabled-text',
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
