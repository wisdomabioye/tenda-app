import { create } from 'zustand'
import { createNativeGasConfirmationState, type NativeGasConfirmationState } from '@tenda/shared'

/** Independent web state; consent policy is owned by shared. */
export const useNativeGasConfirmation = create<NativeGasConfirmationState>(createNativeGasConfirmationState)
