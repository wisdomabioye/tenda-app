import { api } from '@/api/client'
import type { UploadType } from '@tenda/shared'

export interface ProofFile {
  uri: string
  mimeType: string
  name: string
}

/**
 * Upload a file to Cloudinary using a server-signed upload request.
 * Supports images, videos, and documents.
 * Returns the secure CDN URL.
 */
export async function uploadToCloudinary(file: ProofFile, type: UploadType): Promise<string> {
  const { signature, timestamp, cloud_name, api_key, folder } = await api.upload.signature({ type })

  const formData = new FormData()
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as any)
  formData.append('api_key', api_key)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)
  formData.append('folder', folder)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error?.error?.message ?? 'Cloudinary upload failed')
  }

  const result = await response.json() as { secure_url: string }
  return result.secure_url
}
