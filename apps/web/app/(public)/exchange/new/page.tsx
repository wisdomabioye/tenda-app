import { notFound } from 'next/navigation'

/** Retired route: keep the static segment from being claimed as an exchange id. */
export default function RetiredExchangeNewPage(): never {
  notFound()
}
