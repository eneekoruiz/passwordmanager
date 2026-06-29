import { useState } from 'react'
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'

export function MasterPasswordPromptModal() {
  const { isPromptingMasterPassword, resolveMasterPasswordPrompt, verifyCurrentMasterPassword } = useVault()
  const [password, setPassword] = useState('')
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  if (!isPromptingMasterPassword) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const valid = await verifyCurrentMasterPassword(password)
    setLoading(false)
    if (valid) {
      resolveMasterPasswordPrompt(true)
      setPassword('')
    } else {
      showToast('Contraseña incorrecta.', 'error')
    }
  }

  const handleCancel = () => {
    setPassword('')
    resolveMasterPasswordPrompt(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-[2rem] bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 shadow-inner">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900">Acceso Seguro</h3>
            <p className="mt-2 text-sm text-slate-500">
              Introduce tu Contraseña Maestra para visualizar esta información sensible.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                }}
                className={`w-full rounded-2xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-indigo-500/20 px-4 py-3 text-sm font-medium shadow-sm transition-all outline-none focus:ring-4`}
                placeholder="Contraseña Maestra..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !password}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50"
              >
                {loading ? 'Verificando...' : 'Autorizar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
