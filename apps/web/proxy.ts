import { NextResponse, type NextRequest } from 'next/server'

const RETIRED_ROUTE_TARGET = '/__retired-route'

/** Ensure retired paths resolve before a dynamic segment or streaming layout can claim them. */
export function proxy(request: NextRequest) {
  return NextResponse.rewrite(new URL(RETIRED_ROUTE_TARGET, request.url))
}

export const config = {
  matcher: ['/exchange/new'],
}
