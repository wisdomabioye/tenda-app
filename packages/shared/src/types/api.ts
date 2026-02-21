import type { ErrorCode } from '../constants/errors'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
  code: ErrorCode
}
