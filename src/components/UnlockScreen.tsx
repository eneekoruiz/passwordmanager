import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'
import { PasswordField } from './ui/PasswordField'
import { Button } from './ui/Button'
import { getFriendlyErrorMessage } from '../utils/errors'
import { RECOVERY_PHRASE_WORD_COUNT, generateRecoveryPhrase, normalizeRecoveryPhrase } from '../utils/recovery'
import { secureRandomInt } from '../utils/random'
import { useOnboarding } from '../hooks/useOnboarding'
import { useRecovery } from '../hooks/useRecovery'

function SecurityNote() {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-900/20 p-3 text-left text-[11px] leading-relaxed text-amber-800 dark:text-amber-200/80">
      <p>
        <span className="font-bold">💡 Nota de seguridad:</span> Tu Contraseña Maestra no es la de tu correo. Es una clave única que solo tú conoces. No se envía a nuestros servidores, por lo que si la pierdes, no podremos recuperarla.
      </p>
    </div>
  )
}

function NativeIdentityStep({
  loading,
  onGoogleAuth,
  onEmailAuth,
  onPasswordReset,
}: {
  loading: boolean
  onGoogleAuth: () => void
  onEmailAuth: (mode: 'login' | 'register', email: string, pass: string) => void
  onPasswordReset: (email: string) => Promise<void>
}) {
  const { showToast } = useToast()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'forgot_password') {
      try {
        await onPasswordReset(email)
        setResetSuccess(true)
      } catch (err) {
        // Error is set in the parent state and passed down
      }
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error')
      return
    }
    onEmailAuth(mode, email, password)
  }

  const handleModeChange = (newMode: 'login' | 'register' | 'forgot_password') => {
    setMode(newMode)
    setResetSuccess(false)
  }

  return (
    <div className="w-full space-y-5 text-left animate-fade-in">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          {mode === 'forgot_password' ? 'Recuperar contraseña' : 'Accede a tu cuenta'}
        </h1>
        <p className="text-xs leading-relaxed text-text-secondary">
          {mode === 'forgot_password'
            ? 'Introduce tu correo para restablecer la contraseña de acceso a tu cuenta de la nube.'
            : 'Inicia sesión o crea una cuenta para sincronizar tu bóveda.'}
        </p>
      </div>

      {mode !== 'forgot_password' && (
        <div className="flex gap-2 rounded-xl bg-surface p-1">
          <button
            type="button"
            onClick={() => handleModeChange('login')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${mode === 'login' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('register')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${mode === 'register' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Crear Cuenta
          </button>
        </div>
      )}

      {resetSuccess && mode === 'forgot_password' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-left text-xs font-medium text-emerald-800 space-y-2">
            <p className="font-bold">📩 Enlace enviado</p>
            <p className="leading-relaxed">
              Hemos enviado un correo electrónico con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleModeChange('login')}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-text-primary px-4 py-3 text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Volver a Iniciar Sesión
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-text-secondary">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ejemplo@correo.com"
              className="w-full rounded-xl border border-black/[0.06] bg-white/85 px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/15 focus:ring-2 focus:ring-black/[0.035]"
            />
          </div>

          {mode !== 'forgot_password' && (
            <>
              <PasswordField
                label="Contraseña"
                value={password}
                onChange={setPassword}
                required
                hideCopy
                placeholder="Escribe tu contraseña de acceso"
              />

              {mode === 'login' && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleModeChange('forgot_password')}
                    className="text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors outline-none cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña de la nube?
                  </button>
                </div>
              )}
            </>
          )}

          {mode === 'register' && (
            <PasswordField
              label="Confirmar Contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              hideCopy
              placeholder="Repite tu contraseña de acceso"
            />
          )}

          {mode === 'forgot_password' ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-3 text-left text-[11px] leading-relaxed text-amber-800">
              <p>
                <span className="font-bold">⚠️ Importante:</span> Esta acción solo restablece la contraseña de tu cuenta de la nube (sincronización). La <span className="font-bold">Contraseña Maestra local</span> de descifrado no se guarda en ningún servidor y <span className="font-bold">no se puede restablecer</span> por este medio.
              </p>
            </div>
          ) : (
            <SecurityNote />
          )}


          <div className="space-y-3 mt-6">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading || !email || (mode !== 'forgot_password' && !password) || (mode === 'register' && password !== confirmPassword)}
            >
              {loading
                ? mode === 'login'
                  ? 'Iniciando sesión...'
                  : mode === 'register'
                    ? 'Creando cuenta...'
                    : 'Enviando enlace...'
                : mode === 'login'
                  ? 'Entrar con correo'
                  : mode === 'register'
                    ? 'Registrarse'
                    : 'Enviar enlace de recuperación'}
            </Button>

            {mode === 'forgot_password' && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => handleModeChange('login')}
              >
                Volver a Iniciar Sesión
              </Button>
            )}
          </div>
        </form>
      )}

      {mode !== 'forgot_password' && (
        <>
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-black/[0.06]"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">o continuar con</span>
            <div className="flex-grow border-t border-black/[0.06]"></div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onGoogleAuth}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white py-3 text-xs font-semibold text-text-primary shadow-sm transition-all hover:bg-surface-hover disabled:opacity-50 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" width="24" height="24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Google (Método secundario)
          </button>
        </>
      )}
    </div>
  )
}

function BiometricMasterPasswordShortcut({
  loading,
  failed,
  onUnlock,
}: {
  loading: boolean
  failed?: boolean
  onUnlock: () => void
}) {
  return (
    <div className={`rounded-2xl border p-3 text-left shadow-sm ${failed ? 'border-amber-200 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-900/20' : 'border-emerald-100 bg-emerald-50/80 dark:border-emerald-700/50 dark:bg-emerald-900/20'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-bold ${failed ? 'text-amber-950 dark:text-amber-400' : 'text-emerald-950 dark:text-emerald-400'}`}>
            {failed ? 'Biometría no disponible' : 'Desbloqueo biométrico disponible'}
          </p>
          <p className={`mt-0.5 text-[11px] leading-relaxed ${failed ? 'text-amber-800 dark:text-amber-200/70' : 'text-emerald-800 dark:text-emerald-200/70'}`}>
            {failed
              ? 'El dispositivo no pudo verificar la biometría. Usa tu Contraseña Maestra debajo para entrar.'
              : 'Usa la llave de acceso local protegida por Face ID, huella o Windows Hello.'}
          </p>
        </div>
        {!failed && (
          <button
            type="button"
            onClick={onUnlock}
            disabled={loading}
            className="shrink-0 rounded-xl bg-emerald-950 px-3 py-2 text-[11px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
          >
            {loading ? 'Verificando...' : 'Desbloquear'}
          </button>
        )}
        {failed && (
          <button
            type="button"
            onClick={onUnlock}
            disabled={loading}
            className="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-[11px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
          >
            {loading ? 'Verificando...' : 'Reintentar'}
          </button>
        )}
      </div>
    </div>
  )
}

function HardwareKeyMasterPasswordShortcut({
  loading,
  onUnlock,
}: {
  loading: boolean
  onUnlock: () => void
}) {
  return (
    <div className="rounded-2xl border p-3 text-left shadow-sm border-blue-100 bg-blue-50/80 dark:border-blue-700/50 dark:bg-blue-900/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-blue-950 dark:text-blue-400">
            Llave de seguridad (YubiKey) disponible
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800 dark:text-blue-200/70">
            Inserta tu llave de seguridad o acércala por NFC para desbloquear.
          </p>
        </div>
        <button
          type="button"
          onClick={onUnlock}
          disabled={loading}
          className="shrink-0 rounded-xl bg-blue-950 px-3 py-2 text-[11px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
        >
          {loading ? 'Verificando...' : 'Usar llave física'}
        </button>
      </div>
    </div>
  )
}


type OnboardingRecoveryStep = 'display' | 'verify'

function createSeedChallengeIndices(wordCount: number): number[] {
  const pool = Array.from({ length: wordCount }, (_, index) => index)
  const challengeCount = Math.min(4, Math.max(3, Math.floor(wordCount / 6)))

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInt(index + 1)
    ;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
  }

  return pool.slice(0, challengeCount).sort((a, b) => a - b)
}

export function UnlockScreen() {
  const {
    cloudUserEmail,
    cloudSyncStatus,
    cloudVaultExists,
    loginWithGoogleCloud,
    loginWithEmailAndPassword,
    registerWithEmailAndPassword,
    sendCloudPasswordResetEmail,
    logoutCloud,
    initializeNewVault,
    unlockOrRestoreVault,
    recoverVaultWithSeed,
    nukeAccount,
    biometricRegistered,
    unlockWithBiometricSensor,
    hardwareKeyAvailable,
    hardwareKeyRegistered,
    unlockWithHardwareKeySensor,
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
  const { showToast } = useToast()
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [biometricFailed, setBiometricFailed] = useState(false)
  const [hardwareKeyLoading, setHardwareKeyLoading] = useState(false)
  // Guard: solo lanzar biometría automáticamente una vez al montar la pantalla de desbloqueo
  const hasMountedBiometricRef = useRef(false)

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
      const phrase = generateRecoveryPhrase()
      const wordCount = phrase.split(' ').filter(Boolean).length
      setRecoveryPhrase(phrase)
      setSeedChallengeIndices(createSeedChallengeIndices(wordCount))
      setSeedChallengeAnswers({})
      setResponsibilityChecks({ masterPassword: false, seedSaved: false, totalLoss: false })
      setOnboardingRecoveryStep('display')
    }
  }, [cloudVaultExists, recoveryPhrase])


  useEffect(() => {
    if (cloudVaultExists !== false && biometricRegistered && !hasMountedBiometricRef.current) {
      hasMountedBiometricRef.current = true
      
      const isAndroid = /Android/i.test(navigator.userAgent);
      
      // En escritorio e iOS, llamar a WebAuthn automáticamente puede causar bucles
      // de renderizado con React StrictMode o colgar la promesa silenciosamente.
      // Por tanto, sólo lo lanzamos automáticamente en Android.
      if (isAndroid) {
        handleBiometricVaultUnlock()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudVaultExists])

  const handleCopyRecoveryPhrase = async () => {
    await navigator.clipboard.writeText(recoveryPhrase)
    setRecoveryCopied(true)
  }

  const handleDownloadRecoveryPhrase = () => {
    const blob = new Blob(
      [
        `Contras - Kit de Recuperación de Emergencia\n\n${recoveryPhrase}\n\nSi olvidas tu Contraseña Maestra, esta es la UNICA forma de recuperar tus datos.`,
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
      
      setLoading(true)
      void loginAttempt
        .catch((caughtError) => {
          showToast(getFriendlyErrorMessage(caughtError, 'Error al conectar con Google.'), 'error')
        })
        .finally(() => setLoading(false))
    } catch (caughtError) {
      setLoading(false)
      showToast(getFriendlyErrorMessage(caughtError, 'Error al conectar con Google.'), 'error')
    }
  }

  const handleEmailAuth = async (mode: 'login' | 'register', emailInput: string, passwordInput: string) => {
    
    setLoading(true)
    try {
      if (mode === 'login') {
        await loginWithEmailAndPassword(emailInput, passwordInput)
      } else {
        await registerWithEmailAndPassword(emailInput, passwordInput)
      }
    } catch (caughtError) {
      showToast(getFriendlyErrorMessage(caughtError, mode === 'login' ? 'Error al iniciar sesión.' : 'Error al registrar la cuenta.'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (emailInput: string) => {
    
    setLoading(true)
    try {
      await sendCloudPasswordResetEmail(emailInput)
    } catch (caughtError) {
      showToast(getFriendlyErrorMessage(caughtError, 'Error al enviar el correo de restablecimiento de contraseña.'), 'error')
      throw caughtError
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricVaultUnlock = async () => {
    
    setBiometricLoading(true)
    setBiometricFailed(false)
    try {
      await unlockWithBiometricSensor()
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (caughtError) {
      const message = getFriendlyErrorMessage(caughtError, 'No se pudo completar la autenticación biométrica.')
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('timed out or was not allowed')) {
        showToast(message, 'error')
        setBiometricFailed(true)
      }
    } finally {
      setBiometricLoading(false)
    }
  }

  const handleHardwareKeyVaultUnlock = async () => {
    
    setHardwareKeyLoading(true)
    try {
      await unlockWithHardwareKeySensor()
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (caughtError) {
      const message = getFriendlyErrorMessage(caughtError, 'No se pudo completar la autenticación con la llave física.')
      if (!message.toLowerCase().includes('cancel') && !message.toLowerCase().includes('timed out or was not allowed')) {
        showToast(message, 'error')
      }
    } finally {
      setHardwareKeyLoading(false)
    }
  }

  const handleVaultAction = async (event: FormEvent) => {
    event.preventDefault()
    

    if (!masterPassword) {
      showToast('Introduce tu Contraseña Maestra para continuar.', 'error')
      return
    }

    setLoading(true)
    try {
      if (cloudVaultExists === false) {
        if (masterPassword.length < 8) {
          showToast('La Contraseña Maestra debe tener al menos 8 caracteres.', 'error')
          return
        }
        if (masterPassword !== confirmMasterPassword) {
          showToast('Las Contraseñas Maestras no coinciden.', 'error')
          return
        }
        if (!canCreateVault) {
          showToast('Completa la verificación de la Frase Semilla y acepta las responsabilidades antes de crear la bóveda.', 'error')
          return
        }
        await initializeNewVault(masterPassword, normalizeRecoveryPhrase(recoveryPhrase))
      } else {
        await unlockOrRestoreVault(masterPassword)
      }
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (caughtError) {
      showToast(getFriendlyErrorMessage(caughtError, 'No se pudo abrir la Bóveda Local.'))
    } finally {
      setLoading(false)
    }
  }

  const handleRecovery = async (event: FormEvent) => {
    event.preventDefault()
    

    if (!recoveryInput.trim()) {
      showToast('Introduce tu Frase Semilla de Recuperación.', 'error')
      return
    }
    if (newMasterPassword.length < 8) {
      showToast('La nueva Contraseña Maestra debe tener al menos 8 caracteres.', 'error')
      return
    }
    if (newMasterPassword !== confirmNewMasterPassword) {
      showToast('Las nuevas Contraseñas Maestras no coinciden.', 'error')
      return
    }

    setLoading(true)
    try {
      await recoverVaultWithSeed(normalizedRecoveryPhrase, newMasterPassword)
      setRecoveryInput('')
      setNewMasterPassword('')
      setConfirmNewMasterPassword('')
    } catch (caughtError) {
      showToast(getFriendlyErrorMessage(caughtError, 'No se pudo recuperar la bóveda.'))
    } finally {
      setLoading(false)
    }
  }

  const handleNukeAccount = async () => {
    
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
      showToast(getFriendlyErrorMessage(caughtError, 'No se pudo destruir la cuenta.'))
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    
    setLoading(true)
    try {
      await logoutCloud()
      setMasterPassword('')
      setConfirmMasterPassword('')
    } catch (caughtError) {
      showToast(getFriendlyErrorMessage(caughtError, 'Error al cambiar la cuenta de sincronización.'))
    } finally {
      setLoading(false)
    }
  }

  const isCloudLoading = cloudSyncStatus === 'syncing'
  const canUseBiometricUnlock = cloudVaultExists !== false && biometricRegistered
  const canUseHardwareKeyUnlock = cloudVaultExists !== false && hardwareKeyAvailable && hardwareKeyRegistered
  const { recoveryWords, canCreateVault } = useOnboarding({
    cloudVaultExists,
    masterPassword,
    confirmMasterPassword,
    recoveryPhrase,
    recoveryCopied,
    onboardingRecoveryStep,
    seedChallengeIndices,
    seedChallengeAnswers,
    responsibilityChecks,
  })
  const { normalizedRecoveryPhrase, canSubmitRecovery } = useRecovery({
    recoveryInput,
    newMasterPassword,
    confirmNewMasterPassword,
    loading,
  })

  return (
    <div className="vault-shell vault-stage flex h-dvh max-h-dvh select-none flex-col overflow-hidden lg:flex-row">
      <section className="unlock-story relative m-3 mr-0 hidden w-[46%] overflow-hidden rounded-[34px] border border-white/10 bg-[#0b1713] p-10 text-white shadow-[0_34px_100px_rgba(5,35,27,.28)] lg:flex lg:flex-col lg:justify-between">
        <div className="unlock-aurora" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="brand-glyph"><span /></div>
          <div>
            <p className="text-lg font-black tracking-[-0.04em]">Contras</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/45">Private intelligence</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="security-orbit mb-10" aria-hidden="true">
            <div className="security-orbit-ring security-orbit-ring-two" />
            <div className="security-orbit-core"><div className="brand-glyph"><span /></div></div>
            <span className="orbit-node orbit-node-one" />
            <span className="orbit-node orbit-node-two" />
            <span className="orbit-node orbit-node-three" />
          </div>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-300/70">Tu vida digital. Solo tuya.</p>
          <h2 className="max-w-lg text-[clamp(2.5rem,4.6vw,4.8rem)] font-black leading-[0.94] tracking-[-0.065em] text-white">
            Seguridad que se siente invisible.
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-emerald-50/55">
            Tus credenciales se descifran en este dispositivo. Sin puertas traseras, sin concesiones y sin ruido.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            ['Zero-knowledge', 'Cifrado local'],
            ['Passkeys', 'Acceso biométrico'],
            ['Offline-first', 'Siempre disponible'],
          ].map(([title, detail]) => (
            <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3.5 backdrop-blur-sm">
              <p className="text-[11px] font-bold text-white/90">{title}</p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="relative m-2 flex min-w-0 flex-1 flex-col items-center justify-center overflow-y-auto pb-24 rounded-[34px] px-4 py-8 lg:m-3 lg:pb-8">
        <div className="vault-glass flex w-full max-w-md flex-col items-center rounded-[32px] p-6 text-center animate-fade-in sm:p-8">
        {cloudUserEmail === null ? (
          <NativeIdentityStep
            loading={loading || isCloudLoading}
            onGoogleAuth={handleGoogleAuth}
            onEmailAuth={handleEmailAuth}
            onPasswordReset={handlePasswordReset}
          />
        ) : (
          <div className="w-full space-y-5">
            {cloudVaultExists === null ? (
              <div className="flex justify-center p-8"><p className="text-sm text-text-secondary animate-pulse">Cargando bóveda...</p></div>
            ) : showRecoveryFlow ? (
              <form onSubmit={handleRecovery} className="w-full space-y-5 animate-vault-morph">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-text-primary">Recuperar acceso</h1>
                  <p className="text-xs leading-relaxed text-text-secondary">
                    Este es el salvavidas de la bóveda. Pega tu Frase Semilla para demostrar que eres el propietario y define una nueva Contraseña Maestra.
                  </p>
                </div>
                <textarea
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  placeholder={`pega aqui tus ${RECOVERY_PHRASE_WORD_COUNT} palabras de recuperacion`}
                  className="min-h-[92px] w-full rounded-2xl border border-border-subtle bg-white/72 dark:bg-white/5 px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-black/15 dark:focus:border-white/20 focus:ring-2 focus:ring-black/[0.035] dark:focus:ring-white/[0.035]"
                />
                <PasswordField
                  label="Nueva Contraseña Maestra"
                  value={newMasterPassword}
                  onChange={setNewMasterPassword}
                  required
                  hideCopy
                  placeholder="Nueva contraseña"
                />
                <PasswordField
                  label="Confirmar nueva Contraseña Maestra"
                  value={confirmNewMasterPassword}
                  onChange={setConfirmNewMasterPassword}
                  required
                  hideCopy
                  placeholder="Repite la nueva contraseña"
                />
                      <button
                  type="submit"
                  disabled={!canSubmitRecovery}
                  className="vault-button-primary flex min-h-12 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 active:scale-[0.98]"
                >
                  {loading ? 'Recuperando y re-cifrando...' : 'Recuperar bóveda'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryFlow(false)
                    
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
                  ¿Has perdido también tu Frase Semilla? Resetear cuenta
                </button>
              </form>
            ) : (
              <form onSubmit={handleVaultAction} className="w-full space-y-5">
                    <div className="space-y-1">
                      <h1 className="text-xl font-bold tracking-tight text-text-primary">Desbloquea tu Bóveda Local</h1>
                      <p className="text-xs leading-relaxed text-text-secondary">
                        Introduce tu <strong>Contraseña Maestra</strong>. Es la llave criptográfica de tu bóveda: no se envía a nuestros servidores, no la conocemos y no podemos recuperarla por ti.
                      </p>
                    </div>

                    {canUseBiometricUnlock && (
                      <BiometricMasterPasswordShortcut
                        loading={loading || biometricLoading}
                        failed={biometricFailed}
                        onUnlock={handleBiometricVaultUnlock}
                      />
                    )}

                    {canUseHardwareKeyUnlock && (
                      <HardwareKeyMasterPasswordShortcut
                        loading={loading || hardwareKeyLoading}
                        onUnlock={handleHardwareKeyVaultUnlock}
                      />
                    )}

                    <div className="space-y-3.5 text-left">
                      <PasswordField
                        label={cloudVaultExists === false ? 'Crear Contraseña Maestra' : 'Contraseña Maestra'}
                        value={masterPassword}
                        onChange={setMasterPassword}
                        required
                        hideCopy
                        placeholder="Contraseña Maestra"
                      />

                      {cloudVaultExists !== false && (
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRecoveryFlow(true)
                            }}
                            className="text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
                          >
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                      )}

                      {cloudVaultExists === false && (
                        <PasswordField
                          label="Confirmar Contraseña Maestra"
                          value={confirmMasterPassword}
                          onChange={setConfirmMasterPassword}
                          required
                          hideCopy
                          placeholder="Repite tu contraseña"
                        />
                      )}
                    </div>

                    {cloudVaultExists === false && recoveryPhrase && (
                      <div className="space-y-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-900/20 p-4 text-left shadow-sm animate-vault-morph">
                        <div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-400">Kit de Recuperación de Emergencia</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200/80">
                            Esta Frase Semilla es tu único salvavidas zero-knowledge. Si olvidas la Contraseña Maestra, estas palabras son la unica forma de recuperar y re-cifrar la bóveda. Guárdalas fuera de este dispositivo.
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
                                Verificación obligatoria
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
          
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        !masterPassword ||
                        (cloudVaultExists === false &&
                          !canCreateVault)
                      }
                      className="vault-button-primary flex min-h-12 w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-40 active:scale-[0.98]"
                    >
                      {loading
                        ? cloudVaultExists === false
                          ? 'Inicializando bóveda...'
                          : 'Desbloqueando bóveda...'
                        : cloudVaultExists === false
                          ? 'Comenzar a usar la bóveda'
                          : 'Desbloquear Bóveda Local'}
                    </button>
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
      </div>
      {showNukeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-950/35 p-4 backdrop-blur-md animate-vault-morph">
          <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white/95 p-6 text-left shadow-[0_30px_100px_rgba(127,29,29,0.28)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 19.07h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3.93c-.77-1.33-2.69-1.33-3.46 0L3.2 16.07c-.77 1.33.19 3 1.73 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-red-950">Danger Zone: reset irreversible</h2>
            <p className="mt-3 text-sm leading-relaxed text-red-900">
              Si has perdido tanto la Contraseña Maestra como la Frase Semilla, tus datos son matemáticamente irrecuperables. Esta acción elimina la bóveda cifrada y empieza desde cero. No hay soporte, backend ni administrador que pueda revertirlo.
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
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowNukeModal(false)
                  setNukeConfirmation('')
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

      {/* Legal terms footer */}
      <div className="pointer-events-auto absolute bottom-4 w-full px-4 text-center sm:bottom-6 lg:bottom-2 lg:left-[46%] lg:w-[54%]">
        <p className="mx-auto max-w-xl rounded-full border border-white/50 bg-white/45 px-4 py-2 text-[11px] text-text-tertiary shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
          Al usar Contras, aceptas nuestros <button type="button" onClick={() => setShowTerms(true)} className="underline hover:text-text-primary outline-none">Términos de Servicio</button> y <button type="button" onClick={() => setShowPrivacy(true)} className="underline hover:text-text-primary outline-none">Política de Privacidad</button>.
        </p>
      </div>

      {showTerms && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl border border-white/50 bg-white p-0 shadow-2xl flex flex-col">
            <div className="p-6 border-b border-black/5 flex-shrink-0">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Términos de Servicio</h2>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-600 space-y-4">
              <p>Última actualización: 1 de Julio de 2026</p>
              <h3 className="font-bold text-slate-800">1. Naturaleza del servicio</h3>
              <p>Contras es un gestor de contraseñas de conocimiento cero. Todos los datos sensibles (contraseñas, notas) se cifran y descifran localmente en el dispositivo del usuario utilizando una Contraseña Maestra que nunca se envía a nuestros servidores.</p>
              <h3 className="font-bold text-slate-800">2. Responsabilidad del Usuario</h3>
              <p>Dado que no tenemos acceso a la Contraseña Maestra ni a los datos descifrados, es responsabilidad absoluta del usuario recordar o guardar de forma segura su Contraseña Maestra y/o Frase de Recuperación. La pérdida de ambos resultará en la pérdida irreversible de los datos.</p>
              <h3 className="font-bold text-slate-800">3. Limitación de Responsabilidad</h3>
              <p>El servicio se proporciona "tal cual". Contras no será responsable por la pérdida de datos, accesos no autorizados debidos a dispositivos comprometidos, u otros daños indirectos derivados del uso de la aplicación.</p>
            </div>
            <div className="p-4 border-t border-black/5 dark:border-white/5 bg-slate-50 dark:bg-slate-900 flex-shrink-0 flex justify-end">
              <button type="button" onClick={() => setShowTerms(false)} className="rounded-xl bg-slate-800 dark:bg-white dark:text-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-700 dark:hover:bg-slate-200 active:scale-95">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacy && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl border border-white/50 bg-white p-0 shadow-2xl flex flex-col">
            <div className="p-6 border-b border-black/5 flex-shrink-0">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Política de Privacidad</h2>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-600 space-y-4">
              <p>Última actualización: 1 de Julio de 2026</p>
              <h3 className="font-bold text-slate-800">Cifrado de Conocimiento Cero (Zero-Knowledge)</h3>
              <p>Contras está diseñado bajo el principio de "Conocimiento Cero". Esto significa que cualquier dato sensible (contraseñas, secretos, notas privadas) se cifra localmente en tu dispositivo antes de enviarse a la nube. Nadie, ni siquiera los administradores de Contras, Google (nuestro proveedor de nube) o cualquier tercero, puede descifrar o leer tus datos sin tu Contraseña Maestra.</p>
              <h3 className="font-bold text-slate-800">Datos que recopilamos (Nube)</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Dirección de correo electrónico (si usas la sincronización en la nube o inicias sesión con Google/Email).</li>
                <li>Tu bóveda cifrada, como un bloque opaco de datos (`encrypted_vault_blob`).</li>
                <li>Metadatos básicos de sincronización (timestamp, contador de plataformas públicas).</li>
              </ul>
              <h3 className="font-bold text-slate-800">Uso de Cookies y Almacenamiento Local</h3>
              <p>Contras utiliza `localStorage` y APIs nativas del navegador (como WebAuthn) para guardar la configuración (ej. modo de ordenación), los datos locales y las llaves biométricas. No usamos cookies de rastreo de terceros (tracking cookies).</p>
            </div>
            <div className="p-4 border-t border-black/5 dark:border-white/5 bg-slate-50 dark:bg-slate-900 flex-shrink-0 flex justify-end">
              <button type="button" onClick={() => setShowPrivacy(false)} className="rounded-xl bg-slate-800 dark:bg-white dark:text-black px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-700 dark:hover:bg-slate-200 active:scale-95">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

