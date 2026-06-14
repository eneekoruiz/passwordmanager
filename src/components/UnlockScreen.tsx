import { useEffect, useState, type FormEvent } from 'react'
import { useVault } from '../context/VaultContext'
import { PasswordField } from './ui/PasswordField'
import { getFriendlyErrorMessage } from '../utils/errors'

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

export function UnlockScreen() {
  const {
    cloudUserEmail,
    cloudSyncStatus,
    cloudError,
    cloudVaultExists,
    loginWithGoogleCloud,
    logoutCloud,
    initializeNewVault,
    unlockOrRestoreVault,
  } = useVault()

  const [masterPassword, setMasterPassword] = useState('')
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (cloudError) setError(cloudError)
  }, [cloudError])

  useEffect(() => {
    return () => {
      setMasterPassword('')
      setConfirmMasterPassword('')
    }
  }, [])

  const handleGoogleAuth = async () => {
    setError(null)
    setLoading(true)
    try {
      await loginWithGoogleCloud()
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'Error al conectar con Google.'))
    } finally {
      setLoading(false)
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
        await initializeNewVault(masterPassword)
      } else {
        await unlockOrRestoreVault(masterPassword)
      }
    } catch (caughtError) {
      setError(getFriendlyErrorMessage(caughtError, 'No se pudo abrir la Bóveda Local.'))
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

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 py-8 select-none">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-black/5 bg-white/70 p-6 text-center shadow-[0_15px_50px_rgba(0,0,0,0.06)] backdrop-blur-xl animate-fade-in sm:p-8">
        {cloudUserEmail === null ? (
          <div className="w-full space-y-6">
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-text-primary">Sincronización en la Nube</h1>
              <p className="text-xs leading-relaxed text-text-secondary">
                Inicia sesión para mantener tus contraseñas seguras y sincronizadas.
              </p>
            </div>

            <SecurityNote />
            {error && <ErrorMessage error={error} />}

            <button
              type="button"
              disabled={loading || isCloudLoading}
              onClick={handleGoogleAuth}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white py-3.5 text-xs font-semibold text-text-primary shadow-sm transition-all hover:bg-surface-hover disabled:opacity-50 active:scale-[0.98]"
            >
              {loading || isCloudLoading ? 'Conectando con Google...' : 'Continuar con Google'}
            </button>
          </div>
        ) : (
          <div className="w-full space-y-5">
            {cloudVaultExists === null ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <svg className="h-6 w-6 animate-spin text-text-secondary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-xs font-medium text-text-secondary">Buscando bóveda en tu cuenta de la nube...</p>
              </div>
            ) : (
              <form onSubmit={handleVaultAction} className="w-full space-y-5">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-text-primary">Desbloquea tu Bóveda Local</h1>
                  <p className="text-xs leading-relaxed text-text-secondary">
                    Introduce tu <strong>Contraseña Maestra</strong> para abrirla. Nunca se envía a nuestros servidores.
                  </p>
                </div>

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

                <SecurityNote />
                {error && <ErrorMessage error={error} />}

                <button
                  type="submit"
                  disabled={
                    loading ||
                    isCloudLoading ||
                    !masterPassword ||
                    (cloudVaultExists === false &&
                      (masterPassword.length < 8 || masterPassword !== confirmMasterPassword))
                  }
                  className="flex w-full items-center justify-center rounded-xl bg-text-primary py-3 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 active:scale-[0.98]"
                >
                  {loading || isCloudLoading
                    ? cloudVaultExists === false
                      ? 'Inicializando bóveda...'
                      : 'Desbloqueando bóveda...'
                    : cloudVaultExists === false
                      ? 'Crear Bóveda Local'
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
  )
}
