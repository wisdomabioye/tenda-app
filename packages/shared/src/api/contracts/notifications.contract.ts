import type { Endpoint } from '../endpoint'
import type { RegisterDeviceTokenInput } from '../../types'

export interface NotificationsContract {
  registerToken: Endpoint<'POST', undefined, RegisterDeviceTokenInput, undefined, { ok: boolean }>
}
