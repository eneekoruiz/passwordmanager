import { useState, useMemo } from 'react'
import type { Identity } from '../types'
import { POPULAR_SERVICES } from '../data/popularServices'
import { Combobox } from './ui/Combobox'
import { BottomSheet } from './ui/BottomSheet'

interface CreateAccountModalProps {
  isOpen: boolean
  onClose: () => void
  identities: Identity[]
  initialIdentityId: string | null
  initialPlatformName: string | null
  onProceed: (identityId: string, platformName: string, isNewIdentityEmail?: string) => void
}

export function CreateAccountModal({
  isOpen,
  onClose,
  identities,
  initialIdentityId,
  initialPlatformName,
  onProceed,
}: CreateAccountModalProps) {
  // State
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>(() => {
    if (initialIdentityId) return initialIdentityId
    return identities.length > 0 ? identities[0].id : 'new'
  })
  const [newIdentityEmail, setNewIdentityEmail] = useState('')
  const [platformName, setPlatformName] = useState(() => initialPlatformName || '')

  // Memoized options for the identity dropdown
  const identityOptions = useMemo(() => {
    const opts = identities.map((id) => ({
      id: id.id,
      label: id.email,
    }))
    opts.push({ id: 'new', label: '+ Crear nueva identidad' })
    return opts
  }, [identities])

  // Check if platform already exists in the selected identity
  const existingPlatform = useMemo(() => {
    if (selectedIdentityId === 'new' || !platformName.trim()) return false
    const identity = identities.find((id) => id.id === selectedIdentityId)
    if (!identity) return false
    return identity.platforms.some((p) => p.name.toLowerCase() === platformName.trim().toLowerCase())
  }, [selectedIdentityId, platformName, identities])

  // Handlers
  const handleProceed = () => {
    const pName = platformName.trim()
    if (!pName) return

    if (selectedIdentityId === 'new') {
      const email = newIdentityEmail.trim()
      if (!email) return
      onProceed('new', pName, email)
    } else {
      onProceed(selectedIdentityId, pName)
    }
  }

  const isFormValid = useMemo(() => {
    const pName = platformName.trim()
    if (!pName) return false
    if (selectedIdentityId === 'new' && !newIdentityEmail.trim()) return false
    return true
  }, [platformName, selectedIdentityId, newIdentityEmail])

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-4 sm:p-6 text-left">
        <h2 className="text-xl font-bold text-text-primary dark:text-white mb-6">
          Añadir nueva cuenta
        </h2>

        <div className="space-y-6">
          {/* Identity Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-text-secondary dark:text-slate-300">
              ¿Para qué identidad es?
            </label>
            <div className="relative">
              <select
                value={selectedIdentityId}
                onChange={(e) => setSelectedIdentityId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3 pr-10 text-sm font-semibold text-text-primary outline-none transition-colors focus:border-accent dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                {identityOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-tertiary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>

            {selectedIdentityId === 'new' && (
              <div className="mt-3 animate-vault-slide-up">
                <input
                  type="email"
                  value={newIdentityEmail}
                  onChange={(e) => setNewIdentityEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm font-medium outline-none transition-colors focus:border-accent dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Platform Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-text-secondary dark:text-slate-300">
              ¿De qué plataforma es?
            </label>
            <Combobox
              label=""
              value={platformName}
              options={POPULAR_SERVICES.map((s) => ({ label: s.name, meta: s.domain }))}
              onInputChange={setPlatformName}
              onChange={(value) => {
                const known = POPULAR_SERVICES.find((s) => s.name.toLowerCase() === value.toLowerCase())
                setPlatformName(known ? known.name : value)
              }}
              placeholder="Ej. Amazon, GitHub, Netflix..."
            />
          </div>

          {/* Warning/Info if platform already exists */}
          {existingPlatform && (
            <div className="animate-vault-slide-up rounded-2xl bg-indigo-50 p-4 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">
              <div className="flex gap-3">
                <svg className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div className="text-sm font-medium">
                  <p>Ya tienes cuentas guardadas en {platformName.trim()} para esta identidad.</p>
                  <p className="mt-1 opacity-90">¿Quieres vincular una nueva cuenta?</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-3">
          <button
            type="button"
            disabled={!isFormValid}
            onClick={handleProceed}
            className="w-full rounded-xl vault-button-primary px-4 py-3.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            title={existingPlatform ? 'Añadir nueva cuenta a esta plataforma' : 'Crear plataforma'}
          >
            {existingPlatform ? 'Añadir cuenta vinculada' : 'Continuar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-black/5 bg-surface px-4 py-3.5 text-sm font-bold text-text-secondary transition-colors hover:bg-surface-hover dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="Cancelar"
          >
            Cancelar
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
