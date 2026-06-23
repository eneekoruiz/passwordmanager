import { useEffect, useState, type FormEvent } from 'react'
import { useVault } from '../context/VaultContext'
import { PasswordField } from './ui/PasswordField'
import { getFriendlyErrorMessage } from '../utils/errors'
import { generateRecoveryPhrase, normalizeRecoveryPhrase } from '../utils/recovery'

function SecurityNote() {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3 text-left text-[11px] leading-relaxed text-amber-800">
      <p>
        <span className="font-bold">💡 Nota de seguridad:</span> Tu Contraseña Maestra no es la de tu correo. Es una clave única que solo tú conoces. No se envía a nuestros servidores, por lo que si la pierdes, no podremos recuperarla.
      </p>
    </div>
  )
}

function ErrorMessage({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-left text-xs font-medium leading-normal text-red-700 animate-shake">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{error}</span>
    </div>
  )
}

function GoogleIdentityStep({
  error,
  loading,
  onGoogleAuth,
}: {
  error: string | null
  loading: boolean
  onGoogleAuth: () => void
}) {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Sincronización en la Nube</h1>
        <p className="text-xs leading-relaxed text-text-secondary">
          Inicia sesión con Google para identificarte y conectar tu bóveda cifrada.
        </p>
      </div>

      <SecurityNote />
      {error && <ErrorMessage error={error} />}

      <button
        type="button"
        disabled={loading}
        onClick={onGoogleAuth}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white py-3.5 text-xs font-semibold text-text-primary shadow-sm transition-all hover:bg-surface-hover disabled:opacity-50 active:scale-[0.98]"
      >
        {loading ? 'Conectando con Google...' : 'Continuar con Google'}
      </button>
    </div>
  )
}

function BiometricMasterPasswordShortcut({
  loading,
  onUnlock,
}: {
  loading: boolean
  onUnlock: () => void
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 text-left shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-950">Desbloqueo biométrico disponible</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800">
            Face ID, huella o passkey sustituyen únicamente a la Contraseña Maestra.
          </p>
        </div>
        <button
          type="button"
          onClick={onUnlock}
          disabled={loading}
          className="shrink-0 rounded-xl bg-emerald-950 px-3 py-2 text-[11px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
        >
          {loading ? 'Verificando...' : 'Usar biometría'}
        </button>
      </div>
    </div>
  )
}

function VaultSkeleton() {
  return (
    <div className="w-full space-y-3 py-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="overflow-hidden rounded-2xl border border-black/[0.05] bg-white/70 p-4">
          <div className="h-3 w-28 rounded-full bg-slate-200 shimmer" />
          <div className="mt-3 h-8 rounded-xl bg-slate-100 shimmer" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-slate-100 shimmer" />
        </div>
      ))}
      <p className="text-xs font-medium text-text-secondary">Preparando bóveda cifrada...</p>
    </div>
  )
}

type OnboardingRecoveryStep = 'display' | 'verify'

function createSeedChallengeIndices(): number[] {
  const pool = Array.from({ length: 12 }, (_, index) => index)
  const random = new Uint8Array(12)
  crypto.getRandomValues(random)

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = random[index] % (index + 1)
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }

  return pool.slice(0, 3).sort((a, b) => a - b)
}

export function UnlockScreen() {
  const {
    cloudUserEmail,
    cloudSyncStatus,
    cloudVaultExists,
    loginWithGoogleCloud,
    logoutCloud,
    initializeNewVault,
    unlockOrRestoreVault,
    recoverVaultWithSeed,
    nukeAccount,
    biometricAvailable,
    biometricRegistered,
    unlockWithBiometricSensor,
  } = useVault()

  const [masterPassword, setMasterPassword] = useState('')
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('')
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [recoveryCopied, setRecoveryCopied] = useState(false)
  const [onboardingRecoveryStep, setOnboardingRecoveryStep] = useState<OnboardingRecoveryStep>('display')
  const [seedChallengeIndices, setSeedChallengeIndices] = useState<number[]>([])
  const [seedChallengeAnswers, setSeedChallengeAnswers] = useState<Record<number, string>>({})
  const [responsibilityChecks, setResponsibilityChecks] = useState({
    masterPassword: false,
    seedSaved: false,
    totalLoss: false,
  })
  const [showRecoveryFlow, setShowRecoveryFlow] = useState(false)
  const [recoveryInput, setRecoveryInput] = useState('')
  const [newMasterPassword, setNewMasterPassword] = useState('')
  const [confirmNewMasterPassword, setConfirmNewMasterPassword] = useState('')
  const [showNukeModal, setShowNukeModal] = useState(false)
  const [nukeConfirmation, setNukeConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)

  useEffect(() => {
    return () => {
      setMasterPassword('')
      setConfirmMasterPassword('')
      setRecoveryPhrase('')
      setSeedChallengeAnswers({})
      setRecoveryInput('')
      setNewMasterPassword('')
      setConfirmNewMasterPassword('')
      setNukeConfirmation('')
    }
  }, [])


  useEffect(() => {
    if (cloudVaultExists === false && !recoveryPhrase) {
      setRecoveryPhrase(generateRecoveryPhrase())
      setSeedChallengeIndices(createSeedChallengeIndices())
      setSeedChallengeAnswers({})
      setResponsibilityChecks({ masterPassword: false, seedSaved: false, totalLoss: false })
      setOnboardingRecoveryStep('display')
    }
  }, [cloudVaultExists, recoveryPhrase])

  const handleCopyRecoveryPhrase = async () => {
    await navigator.clipboard.writeText(recoveryPhrase)
    setRecoveryCopied(true)
  }

  const handleDownloadRecoveryPhrase = () => {
    const blob = new Blob(
      [
        `Contras Emergency Recovery Kit\n\n${recoveryPhrase}\n\nSi olvidas tu Contraseña Maestra, esta es la UNICA forma de recuperar tus datos.`,
      ],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contras-emergency-kit.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setRecoveryCopied(true)
  }

  const handleGoogleAuth = () => {
    try {
      // Debe ser la primera operación que inicia trabajo asíncrono. No añadir
      // awaits, timers ni validaciones antes de esta llamada.
      const loginAttempt = loginWithGoogleCloud()
      setError(null)
      setLoading(true)
      void loginAttempt
        .catch((caughtError) => {
          setError(getFriendlyErrorMessage(caughtError, 'Error al conectar con Google.'))
        })
        .finally(() => setLoading(false))
    } catch (caughtError) {
      setLoading(false)
      setError(getFriendlyErrorMessage(caughtError, 'Error al conectar con Google.'))
    }
  }

  const handleBiometricVaultUnlock = async () => {
    setError(null)
    setBiometricLoading(true)
    try {
      await unlockWithBiometricSensor()
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (caughtError) {
      const message = getFriendlyErrorMessage(caughtError, 'No se pudo completar la autenticación biométrica.')
      if (!message.toLowerCase().includes('cancel')) setError(message)
    } finally {
      setBiometricLoading(false)
    }
  }

  const handleVaultAction = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!masterPassword) {
      setError('Introduce tu Contraseña Maestra para continuar.')
      return
    }

    setLoading(true)
    try {
      if (cloudVaultExists === false) {
        if (masterPassword.length < 8) {
          setError('La Contraseña Maestra debe tener al menos 8 caracteres.')
          return
        }
        if (masterPassword !== confirmMasterPassword) {
          setError('Las Contraseñas Maestras no coinciden.')
          return
        }
        const recoveryWords = recoveryPhrase.split(' ')
        const challengePassed = seedChallengeIndices.every(
          (index) => seedChallengeAnswers[index]?.trim().toLowerCase() === recoveryWords[index],
        )
        const responsibilitiesAccepted =
          responsibilityChecks.masterPassword &&
          responsibilityChecks.seedSaved &&
          responsibilityChecks.totalLoss
        if (!recoveryCopied || onboardingRecoveryStep !== 'verify' || !challengePassed || !responsibilitiesAccepted) {
          setError('Completa la verificación de la Frase Semilla y acepta las responsabilidades antes de crear la bóveda.')
          return
        }
        await initializeNewVault(masterPassword, normalizeRecoveryPhrase(recoveryPhrase))
      } else {
        await unlockOrRestoreVault(masterPassword)
      }
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'No se pudo abrir la Bóveda Local.'))
    } finally {
      setLoading(false)
    }
  }

  const handleRecovery = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!recoveryInput.trim()) {
      setError('Introduce tu Frase Semilla de Recuperación.')
      return
    }
    if (newMasterPassword.length < 8) {
      setError('La nueva Contraseña Maestra debe tener al menos 8 caracteres.')
      return
    }
    if (newMasterPassword !== confirmNewMasterPassword) {
      setError('Las nuevas Contraseñas Maestras no coinciden.')
      return
    }

    setLoading(true)
    try {
      await recoverVaultWithSeed(normalizeRecoveryPhrase(recoveryInput), newMasterPassword)
      setRecoveryInput('')
      setNewMasterPassword('')
      setConfirmNewMasterPassword('')
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'No se pudo recuperar la bóveda.'))
    } finally {
      setLoading(false)
    }
  }

  const handleNukeAccount = async () => {
    setError(null)
    setLoading(true)
    try {
      await nukeAccount()
      setShowNukeModal(false)
      setNukeConfirmation('')
      setMasterPassword('')
      setConfirmMasterPassword('')
      setRecoveryInput('')
      setNewMasterPassword('')
      setConfirmNewMasterPassword('')
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'No se pudo destruir la cuenta.'))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setError(null)
    setLoading(true)
    try {
      await logoutCloud()
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'Error al cambiar la cuenta de sincronización.'))
    } finally {
      setLoading(false)
    }
  }

  const isCloudLoading = cloudSyncStatus === 'syncing'
  const canUseBiometricUnlock = cloudVaultExists !== false && biometricAvailable && biometricRegistered
  const recoveryWords = recoveryPhrase.split(' ').filter(Boolean)
  const seedChallengePassed =
    recoveryWords.length === 12 &&
    seedChallengeIndices.length === 3 &&
    seedChallengeIndices.every(
      (index) => seedChallengeAnswers[index]?.trim().toLowerCase() === recoveryWords[index],
    )
  const responsibilitiesAccepted =
    responsibilityChecks.masterPassword &&
    responsibilityChecks.seedSaved &&
    responsibilityChecks.totalLoss
  const canCreateVault =
    cloudVaultExists === false &&
    masterPassword.length >= 8 &&
    masterPassword === confirmMasterPassword &&
    recoveryCopied &&
    onboardingRecoveryStep === 'verify' &&
    seedChallengePassed &&
    responsibilitiesAccepted

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-8 select-none">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-black/5 bg-white/70 p-6 text-center shadow-[0_15px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl animate-fade-in sm:p-8">
        {cloudUserEmail === null ? (
          <GoogleIdentityStep
            error={error}
            loading={loading || isCloudLoading}
            onGoogleAuth={handleGoogleAuth}
          />
        ) : (
          <div className="w-full space-y-5">
            {cloudVaultExists === null ? (
              <VaultSkeleton />
            ) : showRecoveryFlow ? (
              <form onSubmit={handleRecovery} className="w-full space-y-5 animate-vault-morph">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-text-primary">Recuperar acceso</h1>
                  <p className="text-xs leading-relaxed text-text-secondary">
                    Introduce tu Frase Semilla y crea una nueva Contraseña Maestra para re-cifrar la bóveda.
                  </p>
                </div>
                <textarea
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  placeholder="pega aqui tu codigo de recuperacion"
                  className="min-h-[92px] w-full rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/15 focus:ring-2 focus:ring-black/[0.035]"
                />
                <PasswordField
                  label="Nueva Contraseña Maestra"
                  value={newMasterPassword}
                  onChange={setNewMasterPassword}
                  required
                  placeholder="Nueva contraseña"
                />
                <PasswordField
                  label="Confirmar nueva Contraseña Maestra"
                  value={confirmNewMasterPassword}
                  onChange={setConfirmNewMasterPassword}
                  required
                  placeholder="Repite la nueva contraseña"
                />
                {error && <ErrorMessage error={error} />}
                <button
                  type="submit"
                  disabled={loading || !recoveryInput || newMasterPassword.length < 8 || newMasterPassword !== confirmNewMasterPassword}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl bg-text-primary px-4 py-3 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
                >
                  {loading ? 'Recuperando y re-cifrando...' : 'Recuperar bóveda'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryFlow(false)
                    setError(null)
                  }}
                  className="min-h-11 rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover"
                >
                  Volver al desbloqueo
                </button>
                <button
                  type="button"
                  onClick={() => setShowNukeModal(true)}
                  className="min-h-11 rounded-xl px-4 py-2 text-[11px] font-semibold text-red-500/80 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  ¿Has perdido todas tus claves? Empezar de cero
                </button>
              </form>
            ) : (
              <form onSubmit={handleVaultAction} className="w-full space-y-5">
                    <div className="space-y-1">
                      <h1 className="text-xl font-bold tracking-tight text-text-primary">Desbloquea tu Bóveda Local</h1>
                      <p className="text-xs leading-relaxed text-text-secondary">
                        Introduce tu <strong>Contraseña Maestra</strong> para abrirla. Nunca se envía a nuestros servidores.
                      </p>
                    </div>

                    {canUseBiometricUnlock && (
                      <BiometricMasterPasswordShortcut
                        loading={loading || biometricLoading || isCloudLoading}
                        onUnlock={handleBiometricVaultUnlock}
                      />
                    )}

                    <div className="space-y-3.5 text-left">
                      <PasswordField
                        label={cloudVaultExists === false ? 'Crear Contraseña Maestra' : 'Contraseña Maestra'}
                        value={masterPassword}
                        onChange={setMasterPassword}
                        required
                        placeholder="Escribe tu Contraseña Maestra"
                      />

                      {cloudVaultExists === false && (
                        <PasswordField
                          label="Confirmar Contraseña Maestra"
                          value={confirmMasterPassword}
                          onChange={setConfirmMasterPassword}
                          required
                          placeholder="Repite tu Contraseña Maestra"
                        />
                      )}
                    </div>

                    {cloudVaultExists === false && recoveryPhrase && (
                      <div className="space-y-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 text-left shadow-sm animate-vault-morph">
                        <div>
                          <p className="text-xs font-bold text-amber-900">Emergency Recovery Kit</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
                            Si olvidas tu Contraseña Maestra, esta es la UNICA forma de recuperar tus datos. Guarda estas 12 palabras fuera de este dispositivo.
                          </p>
                        </div>
                        {onboardingRecoveryStep === 'display' ? (
                          <div className="space-y-3 animate-vault-morph">
                            <div className="grid grid-cols-2 gap-2 rounded-xl border border-amber-200 bg-white/80 p-3 font-mono text-[12px] leading-6 text-text-primary sm:grid-cols-3">
                              {recoveryWords.map((word, index) => (
                                <div key={`${word}-${index}`} className="select-text rounded-lg bg-amber-50/70 px-2 py-1">
                                  <span className="mr-1 text-[10px] text-amber-700">{index + 1}.</span>
                                  {word}
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={handleCopyRecoveryPhrase}
                                className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-text-primary transition-all hover:bg-surface-hover active:scale-[0.98]"
                              >
                                {recoveryCopied ? 'Copiada' : 'Copiar'}
                              </button>
                              <button
                                type="button"
                                onClick={handleDownloadRecoveryPhrase}
                                className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-text-primary transition-all hover:bg-surface-hover active:scale-[0.98]"
                              >
                                Descargar
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={!recoveryCopied}
                              onClick={() => {
                                setOnboardingRecoveryStep('verify')
                                setError(null)
                              }}
                              className="min-h-11 w-full rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-amber-950 disabled:opacity-40 active:scale-[0.98]"
                            >
                              He guardado la frase. Verificar ahora
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-vault-morph">
                            <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
                              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">
                                Examen de Semilla
                              </p>
                              <div className="space-y-3">
                                {seedChallengeIndices.map((index) => (
                                  <label key={index} className="block">
                                    <span className="mb-1 block text-[11px] font-semibold text-amber-900">
                                      Escribe la palabra número {index + 1}
                                    </span>
                                    <input
                                      value={seedChallengeAnswers[index] ?? ''}
                                      onChange={(event) =>
                                        setSeedChallengeAnswers((answers) => ({
                                          ...answers,
                                          [index]: event.target.value,
                                        }))
                                      }
                                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-base font-semibold text-text-primary outline-none transition-all focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                                      autoComplete="off"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2 rounded-xl border border-amber-200 bg-white/75 p-3">
                              {[
                                ['masterPassword', 'Entiendo que mi Contraseña Maestra no se puede recuperar ni restablecer.'],
                                ['seedSaved', 'He guardado mi Frase Semilla en un lugar seguro.'],
                                ['totalLoss', 'Comprendo que si pierdo ambas claves, perderé el acceso a mis contraseñas para siempre.'],
                              ].map(([key, label]) => (
                                <label key={key} className="flex items-start gap-2 text-[11px] font-semibold leading-relaxed text-amber-950">
                                  <input
                                    type="checkbox"
                                    checked={responsibilityChecks[key as keyof typeof responsibilityChecks]}
                                    onChange={(event) =>
                                      setResponsibilityChecks((checks) => ({
                                        ...checks,
                                        [key]: event.target.checked,
                                      }))
                                    }
                                    className="mt-0.5"
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setOnboardingRecoveryStep('display')}
                              className="min-h-11 rounded-xl px-4 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                            >
                              Volver a ver la frase
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <SecurityNote />
                    {error && <ErrorMessage error={error} />}

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        isCloudLoading ||
                        !masterPassword ||
                        (cloudVaultExists === false &&
                          !canCreateVault)
                      }
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-text-primary px-4 py-3 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
                    >
                      {loading || isCloudLoading
                        ? cloudVaultExists === false
                          ? 'Inicializando bóveda...'
                          : 'Desbloqueando bóveda...'
                        : cloudVaultExists === false
                          ? 'Comenzar a usar la bóveda'
                          : 'Desbloquear Bóveda Local'}
                    </button>
                    {cloudVaultExists !== false && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowRecoveryFlow(true)
                          setError(null)
                        }}
                        className="min-h-11 rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                    {cloudVaultExists !== false && (
                      <button
                        type="button"
                        onClick={() => setShowNukeModal(true)}
                        className="min-h-11 rounded-xl px-4 py-2 text-[11px] font-semibold text-red-500/80 transition-colors hover:bg-red-50 hover:text-red-700"
                      >
                        ¿Has perdido todas tus claves? Empezar de cero
                      </button>
                    )}
              </form>
            )}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading || isCloudLoading}
                className="rounded-lg px-3 py-1.5 text-[10px] font-semibold text-text-secondary transition-all hover:bg-black/[0.03] hover:text-text-primary"
              >
                Cambiar cuenta de sincronización ({cloudUserEmail})
              </button>
            </div>
          </div>
        )}
      </div>
      {showNukeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-950/35 p-4 backdrop-blur-md animate-vault-morph">
          <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white/95 p-6 text-left shadow-[0_30px_100px_rgba(127,29,29,0.28)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 19.07h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3.93c-.77-1.33-2.69-1.33-3.46 0L3.2 16.07c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-red-950">Peligro: Destrucción Total de Bóveda</h2>
            <p className="mt-3 text-sm leading-relaxed text-red-900">
              Si no recuerdas tu Contraseña Maestra ni tu Frase Semilla, tus datos son matemáticamente irrecuperables. Esta acción eliminará permanentemente tu bóveda encriptada y cerrará tu sesión para que puedas crear una cuenta nueva.
            </p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-red-700">
                Escribe DESTRUIR para confirmar
              </span>
              <input
                value={nukeConfirmation}
                onChange={(event) => setNukeConfirmation(event.target.value)}
                className="w-full rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5 text-base font-semibold text-red-950 outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-200"
                autoComplete="off"
              />
            </label>
            {error && <div className="mt-4"><ErrorMessage error={error} /></div>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNukeModal(false)
                  setNukeConfirmation('')
                  setError(null)
                }}
                disabled={loading}
                className="min-h-11 rounded-xl bg-surface-hover px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-active disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleNukeAccount}
                disabled={loading || nukeConfirmation !== 'DESTRUIR'}
                className="min-h-11 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-red-700/20 transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
              >
                {loading ? 'Destruyendo...' : 'Destruir todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
