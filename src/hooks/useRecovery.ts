import { normalizeRecoveryPhrase } from '../utils/recovery'

interface RecoveryState {
  recoveryInput: string
  newMasterPassword: string
  confirmNewMasterPassword: string
  loading: boolean
}

export function useRecovery(state: RecoveryState) {
  const normalizedRecoveryPhrase = normalizeRecoveryPhrase(state.recoveryInput)
  const canSubmitRecovery =
    !state.loading &&
    normalizedRecoveryPhrase.length > 0 &&
    state.newMasterPassword.length >= 8 &&
    state.newMasterPassword === state.confirmNewMasterPassword

  return {
    normalizedRecoveryPhrase,
    canSubmitRecovery,
  }
}
