import { AppHeader } from '@/components/layout/header'

/**
 * Stub body for dashboard surfaces awaiting their build-order slot
 * (#91 disputes → #92 reports/takedown/users → #93 featured + ops).
 */
export function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <AppHeader title={title} />
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          {title} is being rebuilt on the v2 API — coming in the next build phase.
        </p>
      </div>
    </>
  )
}
