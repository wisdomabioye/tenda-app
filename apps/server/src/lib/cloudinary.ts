import { createHash } from 'node:crypto'
import { getConfig } from '@server/config'
import type { CloudinarySignature, UploadType } from '@tenda/shared'

const FOLDER_MAP: Record<UploadType, string> = {
  avatar: 'tenda/avatars',
  proof: 'tenda/proofs',
}

/**
 * S5.12 (closes open #26) per-type upload constraints.
 * `allowed_formats` is a signed Cloudinary upload parameter — uploads with
 * other formats are rejected server-side by Cloudinary. `max_file_bytes`
 * is NOT a signable upload-API parameter (Cloudinary enforces size caps
 * via upload presets); it is returned as the client-side guard value and
 * the matching preset limit is an ops setting (#53).
 */
export const UPLOAD_CONSTRAINTS: Record<
  UploadType,
  { allowed_formats: string; max_file_bytes: number }
> = {
  avatar: { allowed_formats: 'jpg,png,webp', max_file_bytes: 2 * 1024 * 1024 },
  proof: { allowed_formats: 'jpg,png,webp,pdf', max_file_bytes: 10 * 1024 * 1024 },
}

export function generateUploadSignature(type: UploadType, userId?: string): CloudinarySignature {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = getConfig()

  const folder = type === 'proof' && userId
    ? `${FOLDER_MAP.proof}/${userId}`
    : FOLDER_MAP[type]
  const timestamp = Math.round(Date.now() / 1000)
  const constraints = UPLOAD_CONSTRAINTS[type]

  // Signed params must be alphabetically ordered in the string-to-sign.
  const toSign = `allowed_formats=${constraints.allowed_formats}&folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
  const signature = createHash('sha1').update(toSign).digest('hex')

  return {
    signature,
    timestamp,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    folder,
    allowed_formats: constraints.allowed_formats,
    max_file_bytes: constraints.max_file_bytes,
  }
}
