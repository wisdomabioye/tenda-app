import { ArrowLeftRight, BriefcaseBusiness, type LucideIcon } from 'lucide-react'
import { ROUTES } from '@/lib/routes'

export interface CreateOption {
  href: string
  menuLabel: string
  title: string
  description: string
  icon: LucideIcon
}

export const CREATE_OPTIONS: readonly CreateOption[] = [
  {
    href: ROUTES.createGig,
    menuLabel: 'Create gig',
    title: 'Create a gig',
    description: 'Fund a task and publish it for people to take.',
    icon: BriefcaseBusiness,
  },
  {
    href: ROUTES.createOffer,
    menuLabel: 'Create offer',
    title: 'Create an offer',
    description: 'List an exchange offer with your amount, rate and payment window.',
    icon: ArrowLeftRight,
  },
]
