import { createHash } from 'node:crypto'
import { getConfig } from '../config'
import type { CloudinarySignature, UploadType } from '@tenda/shared'

const FOLDER_MAP: Record<UploadType, string> = {
  avatar: 'tenda/avatars',
  proof: 'tenda/proofs',
}

export function generateUploadSignature(type: UploadType): CloudinarySignature {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = getConfig()

  const folder = FOLDER_MAP[type]
  const timestamp = Math.round(Date.now() / 1000)

  const toSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
  const signature = createHash('sha1').update(toSign).digest('hex')

  return {
    signature,
    timestamp,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    folder,
  }
}
