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

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  gig_id: string | null
  content: string
  read_at: string | null
  created_at: string | null
}

export interface SendMessageInput {
  content: string
  gig_id?: string
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
