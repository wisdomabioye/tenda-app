import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function WorkspacePage({ children, width = 'standard', className }: { children: ReactNode; width?: 'narrow' | 'standard' | 'wide'; className?: string }) {
  const widthClass = width === 'narrow' ? 'max-w-xl' : width === 'wide' ? 'max-w-[1000px]' : 'max-w-2xl'
  return <div className={cn('mx-auto w-full px-4 pb-10 pt-8 sm:px-6 sm:pt-10 lg:px-8', widthClass, className)}>{children}</div>
}
