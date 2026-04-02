'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  UsersIcon,
  BriefcaseIcon,
  ArrowLeftRightIcon,
  BarChart2Icon,
  ScaleIcon,
  TriangleAlertIcon,
  MegaphoneIcon,
  BellIcon,
  GiftIcon,
  DollarSignIcon,
  SettingsIcon,
  LogOutIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { clearToken } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/users',         label: 'Users',              icon: UsersIcon },
  { href: '/gigs',          label: 'Gigs',               icon: BriefcaseIcon },
  { href: '/exchange',      label: 'Exchange',           icon: ArrowLeftRightIcon },
  { href: '/reports',       label: 'Reports',            icon: BarChart2Icon },
  { href: '/disputes',      label: 'Disputes',           icon: ScaleIcon },
  { href: '/keywords',      label: 'Blocked Keywords',   icon: TriangleAlertIcon },
  { href: '/announcements', label: 'Announcements',      icon: MegaphoneIcon },
  { href: '/push',          label: 'Push Notifications', icon: BellIcon },
  { href: '/airdrop',       label: 'Airdrop',            icon: GiftIcon },
  { href: '/finance',       label: 'Finance',            icon: DollarSignIcon },
  { href: '/config',        label: 'Platform Config',    icon: SettingsIcon },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  function handleSignOut() {
    clearToken()
    router.push('/login')
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <span className="text-lg font-bold tracking-tight">Tenda Admin</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map(({ href, label, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={pathname.startsWith(href)}>
                  <Link href={href}>
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOutIcon size={18} />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
