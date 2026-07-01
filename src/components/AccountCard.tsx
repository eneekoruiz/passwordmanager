import { useState } from 'react'
import type { Platform } from '../types'
import { accountDisplayName } from '../utils/account'
import { copyToClipboard } from '../utils/clipboard'
import { PlatformLogo } from './ui/PlatformLogo'

interface AccountCardProps {
  account: Platform
  onEdit: () => void
}

export function AccountCard({ account, onEdit }: AccountCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyPassword = async () => {
    const password = (account?.accessMethods || []).find((method) => method?.type === 'PASSWORD')?.password ?? ''
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
        <button
          type="button"
          onClick={handleCopyPassword}
          className="shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-active hover:text-text-secondary"
          aria-label="Copiar contraseña"
        >
          {copied ? (
            <span className="text-xs text-green-600">Copiado</span>
          ) : (
            <span className="text-sm font-mono tracking-wider text-text-tertiary">
              ••••••••
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
