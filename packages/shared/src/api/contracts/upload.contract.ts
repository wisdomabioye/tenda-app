import type { Endpoint } from '../endpoint'
import type { UploadType, CloudinarySignature } from '../../types'

export interface UploadContract {
  signature: Endpoint<'POST', undefined, { type: UploadType; conversation_id?: string }, undefined, CloudinarySignature>
}
