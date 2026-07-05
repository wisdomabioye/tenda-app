import { createHash } from 'node:crypto'
import { getConfig } from '@server/config'
import type { CloudinarySignature, UploadType } from '@tenda/shared'

const FOLDER_MAP: Record<UploadType, string> = {
  avatar: 'tenda/avatars',
  proof: 'tenda/proofs',
  chat: 'tenda/chat',
}

/**
 * S5.12 (closes open #26) per-type upload constraints.
 * `allowed_formats` is a signed Cloudinary upload parameter, uploads with
 * other formats are rejected server-side by Cloudinary. `max_file_bytes`
 * is NOT a signable upload-API parameter (Cloudinary enforces size caps
 * via upload presets); it is returned as the client-side guard value and
 * the matching preset limit is an ops setting (#53).
 */
export const UPLOAD_CONSTRAINTS: Record<
  UploadType,
  { allowed_formats: string; max_file_bytes: number }
> = {
  // Client downscales avatars before upload (mobile pickAvatar), so this cap is
  // generous headroom for the rare large-after-compression case rather than a
  // tight gate, keeps a big source photo from being rejected outright.
  avatar: { allowed_formats: 'jpg,png,webp', max_file_bytes: 10 * 1024 * 1024 },
  proof: { allowed_formats: 'jpg,png,webp,pdf', max_file_bytes: 10 * 1024 * 1024 },
  chat: { allowed_formats: 'jpg,png,webp,pdf', max_file_bytes: 10 * 1024 * 1024 },
}

/** Conversation-scoped chat folder, the send route validates URLs live here. */
export function chatUploadFolder(conversation_id: string, user_id: string): string {
  return `${FOLDER_MAP.chat}/${conversation_id}/${user_id}`
}

/**
 * Strict attachment-URL check: parsed (query strings can't fake a match),
 * hostname pinned to Cloudinary, and the PATH must contain the
 * sender-scoped conversation folder, a signature minted for one
 * conversation cannot be replayed into another.
 */
export function isValidChatAttachmentUrl(
  url: string,
  conversation_id: string,
  user_id: string,
): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return false
  return parsed.pathname.includes(`/${chatUploadFolder(conversation_id, user_id)}/`)
}

export function generateUploadSignature(
  type: UploadType,
  userId?: string,
  conversationId?: string,
): CloudinarySignature {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = getConfig()

  if (type === 'chat' && (conversationId === undefined || userId === undefined)) {
    // Fail loud: an unscoped chat signature would defeat the per-
    // conversation folder isolation the send route relies on.
    throw new Error('chat upload signatures require userId + conversationId')
  }
  const folder =
    type === 'chat' && conversationId !== undefined && userId !== undefined
      ? chatUploadFolder(conversationId, userId)
      : type === 'proof' && userId
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
