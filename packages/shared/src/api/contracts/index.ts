import type { AuthContract } from './auth.contract'
import type { GigsContract } from './gigs.contract'
import type { UsersContract } from './users.contract'
import type { UploadContract } from './upload.contract'
import type { BlockchainContract } from './blockchain.contract'

export interface ApiContract {
  auth: AuthContract
  gigs: GigsContract
  users: UsersContract
  upload: UploadContract
  blockchain: BlockchainContract
}

export type { AuthContract } from './auth.contract'
export type { GigsContract } from './gigs.contract'
export type { UsersContract } from './users.contract'
export type { UploadContract } from './upload.contract'
export type { BlockchainContract } from './blockchain.contract'
