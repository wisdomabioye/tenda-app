import type { AuthContract } from './auth.contract'
import type { GigsContract } from './gigs.contract'
import type { UsersContract } from './users.contract'
import type { UploadContract } from './upload.contract'
import type { BlockchainContract } from './blockchain.contract'
import type { PlatformContract } from './platform.contract'
import type { ConversationsContract } from './conversations.contract'
import type { NotificationsContract } from './notifications.contract'
import type { SubscriptionsContract } from './subscriptions.contract'

export interface ApiContract {
  auth: AuthContract
  gigs: GigsContract
  users: UsersContract
  upload: UploadContract
  blockchain: BlockchainContract
  platform: PlatformContract
  conversations: ConversationsContract
  notifications: NotificationsContract
  subscriptions: SubscriptionsContract
}

export type { AuthContract } from './auth.contract'
export type { GigsContract } from './gigs.contract'
export type { UsersContract } from './users.contract'
export type { UploadContract } from './upload.contract'
export type { BlockchainContract } from './blockchain.contract'
export type { PlatformContract, PlatformConfig } from './platform.contract'
export type { ConversationsContract } from './conversations.contract'
export type { NotificationsContract } from './notifications.contract'
export type { SubscriptionsContract } from './subscriptions.contract'
