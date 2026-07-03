interface OnboardingState {
  cloudVaultExists: boolean | null
  masterPassword: string
  confirmMasterPassword: string
  recoveryPhrase: string
  recoveryCopied: boolean
  onboardingRecoveryStep: 'display' | 'verify'
  seedChallengeIndices: number[]
  seedChallengeAnswers: Record<number, string>
  responsibilityChecks: {
    masterPassword: boolean
    seedSaved: boolean
    totalLoss: boolean
  }
}

export function useOnboarding(state: OnboardingState) {
  const recoveryWords = state.recoveryPhrase.split(' ').filter(Boolean)
  const seedChallengePassed =
    recoveryWords.length >= 12 &&
    state.seedChallengeIndices.length >= 3 &&
    state.seedChallengeIndices.every(
      (index) => state.seedChallengeAnswers[index]?.trim().toLowerCase() === recoveryWords[index],
    )
  const responsibilitiesAccepted =
    state.responsibilityChecks.masterPassword &&
    state.responsibilityChecks.seedSaved &&
    state.responsibilityChecks.totalLoss
  const canCreateVault =
    state.cloudVaultExists === false &&
    state.masterPassword.length >= 8 &&
    state.masterPassword === state.confirmMasterPassword &&
    state.recoveryCopied &&
    state.onboardingRecoveryStep === 'verify' &&
    seedChallengePassed &&
    responsibilitiesAccepted

  return {
    recoveryWords,
    seedChallengePassed,
    responsibilitiesAccepted,
    canCreateVault,
  }
}
