export type ConversationStatus = 'active' | 'closed'

export interface ConversationParticipant {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

export interface Conversation {
  id: string
  user_a_id: string
  user_b_id: string
  status: ConversationStatus
  closed_by: string | null
  closed_at: string | null
  last_message_at: string | null
  created_at: string | null
  other_user: ConversationParticipant
  unread_count: number
  last_message: string | null
}

/** Inbox/push preview placeholder for attachment-only messages (S5.2). */
export const ATTACHMENT_PREVIEW = '📎 Attachment'

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  /** Chat context divider: the escrow (gig or exchange) being discussed. */
  escrow_id: string | null
  /** gig_details.title when the escrow is a gig; trade summary otherwise. */
  escrow_title: string | null
  /** Routes the context divider to the right detail surface. */
  escrow_kind: 'gig' | 'exchange' | null
  content: string
  attachment_url: string | null
  attachment_type: 'image' | 'file' | null
  attachment_size: number | null
  read_at: string | null
  created_at: string | null
}

export interface SendMessageInput {
  content: string
  /** Optional context: the escrow this message is about. */
  escrow_id?: string
  /** S5.2: Cloudinary URL under the conversation's chat folder. */
  attachment_url?: string
  attachment_type?: 'image' | 'file'
  /** Bytes — client-reported; the hard cap is the upload preset. */
  attachment_size?: number
}

export interface GigSubscription {
  id: string
  user_id: string
  city: string
  category: string
  created_at: string | null
}

export interface UpsertSubscriptionInput {
  city?: string
  category?: string
}

export interface RegisterDeviceTokenInput {
  token: string
  platform?: 'expo' | 'fcm' | 'apns'
}

export interface MessagesQuery {
  before_id?: string
  limit?: number
}
