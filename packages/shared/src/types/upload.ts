export interface CloudinarySignature {
  signature: string
  timestamp: number
  cloud_name: string
  api_key: string
  folder: string
  /** Signed Cloudinary param — uploads in other formats are rejected (S5.12). */
  allowed_formats: string
  /** Client-side size guard; the hard cap is the matching upload preset. */
  max_file_bytes: number
}

export type UploadType = 'avatar' | 'proof' | 'chat'
