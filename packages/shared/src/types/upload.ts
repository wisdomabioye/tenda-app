export interface CloudinarySignature {
  signature: string
  timestamp: number
  cloud_name: string
  api_key: string
  folder: string
}

export type UploadType = 'avatar' | 'proof'
