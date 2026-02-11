import { createHash } from 'node:crypto'
import type { CloudinarySignature, UploadType } from '@tenda/shared'

const FOLDER_MAP: Record<UploadType, string> = {
  avatar: 'tenda/avatars',
  proof: 'tenda/proofs',
}

export function generateUploadSignature(type: UploadType): CloudinarySignature {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!

  const folder = FOLDER_MAP[type]
  const timestamp = Math.round(Date.now() / 1000)

  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
  const signature = createHash('sha1').update(toSign).digest('hex')

  return {
    signature,
    timestamp,
    cloud_name: cloudName,
    api_key: apiKey,
    folder,
  }
}
