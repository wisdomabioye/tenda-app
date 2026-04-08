import type { ErrorCode } from '../constants/errors'

export interface PaginatedResponse<T> {
  data:      T[]
  total:     number
  limit:     number
  offset:    number
  /** Present on endpoints that use capped queries — true means more rows exist beyond this page. */
  has_more?: boolean
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
  code: ErrorCode
}
