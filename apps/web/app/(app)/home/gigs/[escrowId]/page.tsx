'use client'
import { useParams } from 'next/navigation'
import { HomeGigDetail } from '@/components/home/HomeGigDetail'
export default function HomeGigPage() {
  const { escrowId } = useParams<{ escrowId: string }>()
  return <HomeGigDetail escrowId={escrowId} />
}
