import { motion, useMotionValue, useTransform } from 'framer-motion'
import type { Platform } from '../types'
import { accountDisplayName } from '../utils/account'
import { copyToClipboard } from '../utils/clipboard'
import { PlatformLogo } from './ui/PlatformLogo'
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'
import { cn } from './ui/BottomSheet' // Using our new cn utility

interface AccountCardProps {
  account: Platform
  onEdit: () => void
  onShare?: () => void
}

export function AccountCard({ account, onEdit, onShare }: AccountCardProps) {
  const { authorizeSensitiveAction } = useVault()
  const { showToast } = useToast()

  // Swipe mechanics
  const x = useMotionValue(0)
  const copyOpacity = useTransform(x, [0, 80], [0, 1])
  const copyScale = useTransform(x, [0, 80], [0.8, 1])
  const shareOpacity = useTransform(x, [0, -80], [0, 1])
  const shareScale = useTransform(x, [0, -80], [0.8, 1])

  const handleCopyPassword = async () => {
    const password = (account?.accessMethods || []).find((method) => method?.type === 'PASSWORD')?.password ?? ''
    if (!password) {
      showToast('Esta cuenta no tiene contraseña guardada', 'error')
      return
    }

    const authorized = await authorizeSensitiveAction('Copiar contraseña')
    if (!authorized) return

    const ok = await copyToClipboard(password)
    if (ok) {
      showToast('Contraseña copiada al portapapeles', 'success')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative w-full rounded-[28px] bg-slate-100/50 dark:bg-slate-800/30 overflow-hidden touch-pan-y"
    >
      {/* Background Swipe Actions Layer */}
      <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
        <motion.div style={{ opacity: copyOpacity, scale: copyScale }} className="flex flex-col items-center justify-center text-teal-600 dark:text-teal-400">
          <div className="bg-teal-100 dark:bg-teal-900/40 p-2.5 rounded-full mb-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider">Copiar</span>
        </motion.div>

        {onShare && (
          <motion.div style={{ opacity: shareOpacity, scale: shareScale }} className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2.5 rounded-full mb-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider">Share</span>
          </motion.div>
        )}
      </div>

      {/* Foreground Draggable Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={(_, info) => {
          if (info.offset.x > 80) handleCopyPassword()
          if (info.offset.x < -80 && onShare) onShare()
        }}
        whileTap={{ scale: 0.985 }}
        style={{ x }}
        onClick={onEdit}
        className={cn(
          "relative z-10 w-full rounded-[28px] p-4 flex items-center gap-4 cursor-pointer",
          "bg-surface shadow-glass border border-white/50 dark:border-white/5",
          "hover:bg-surface-elevated transition-colors will-change-transform"
        )}
      >
        <PlatformLogo name={account.name} className="h-14 w-14 shrink-0 rounded-[18px] shadow-sm bg-white border border-black/5 dark:border-white/10 dark:bg-white/5 p-2" />

        <div className="flex-1 min-w-0 text-left">
          <p className="text-[16px] font-black tracking-tight text-text-primary truncate">
            {accountDisplayName(account)}
          </p>

          <div className="mt-0.5">
            {(account?.accessMethods || [])
              .filter((method) => method?.type === 'SSO')
              .map((method) => {
                const providers = Array.isArray(method?.providers)
                  ? method.providers
                  : (typeof method?.providers === 'string' ? [method.providers] : [])
                return (
                  <p key={method?.id} className="text-[13px] text-text-secondary truncate font-medium">
                    {providers.join(', ')}: {method?.email}
                  </p>
                )
              })}
            {account.username && (
              <p className="text-[13px] text-text-tertiary truncate font-medium">@{account.username}</p>
            )}
            {account.fullName && (
              <p className="text-[13px] text-text-tertiary truncate font-medium">{account.fullName}</p>
            )}
          </div>

          {account.tags && account.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {account.tags.map((tag, idx) => (
                <span key={idx} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chevron Indicator */}
        <div className="shrink-0 pl-2 opacity-30">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </motion.div>
    </motion.div>
  )
}
