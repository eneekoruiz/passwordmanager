import { useState } from 'react'
import type { Platform } from '../types'
import { accountDisplayName } from '../utils/account'
import { copyToClipboard } from '../utils/clipboard'
import { PlatformLogo } from './ui/PlatformLogo'
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'

interface AccountCardProps {
  account: Platform
  onEdit: () => void
  onShare?: () => void
}

export function AccountCard({ account, onEdit, onShare }: AccountCardProps) {
  const [copied, setCopied] = useState(false)
  const { authorizeSensitiveAction } = useVault()
  const { showToast } = useToast()

  const handleCopyPassword = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const password = (account?.accessMethods || []).find((method) => method?.type === 'PASSWORD')?.password ?? ''
    if (!password) {
      showToast('Esta cuenta no tiene contraseña guardada', 'error')
      return
    }

    const authorized = await authorizeSensitiveAction('Copiar contraseña')
    if (!authorized) return

    const ok = await copyToClipboard(password)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-elevated p-4 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-start gap-4">
        <PlatformLogo name={account.name} className="h-10 w-10 rounded-lg" />
        <button type="button" onClick={onEdit} className="flex-1 text-left">
          <p className="text-sm font-medium text-text-primary">
            {accountDisplayName(account)}
          </p>
          {(account?.accessMethods || [])
            .filter((method) => method?.type === 'SSO')
            .map((method) => {
              const providers = Array.isArray(method?.providers)
                ? method.providers
                : (typeof method?.providers === 'string' ? [method.providers] : [])
              return (
                <p key={method?.id} className="mt-0.5 text-sm text-text-secondary truncate">
                  {providers.join(', ')}: {method?.email}
                </p>
              )
            })}
          {account.username && (
            <p className="mt-0.5 text-xs text-text-tertiary truncate">
              @{account.username}
            </p>
          )}
          {account.fullName && (
            <p className="mt-0.5 text-xs text-text-tertiary truncate">
              {account.fullName}
            </p>
          )}
        </button>
        <div className="flex shrink-0 flex-col items-end justify-center gap-2">
          {onShare && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="flex items-center gap-1.5 rounded-lg border border-black/[0.05] bg-surface-primary px-2.5 py-1.5 text-xs font-semibold text-text-primary shadow-sm transition-all hover:bg-surface-hover active:scale-95"
              aria-label="Compartir contraseña"
              title="Compartir con otro usuario"
            >
              <svg className="h-3.5 w-3.5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              <span>Compartir</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyPassword}
            className="flex items-center gap-1.5 rounded-lg border border-black/[0.05] bg-surface-primary px-2.5 py-1.5 text-xs font-semibold text-text-primary shadow-sm transition-all hover:bg-surface-hover active:scale-95"
            aria-label="Copiar contraseña"
          >
            {copied ? (
              <span className="font-bold text-green-600">Copiada</span>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                <span>Copiar Clave</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
