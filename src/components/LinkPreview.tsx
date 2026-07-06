import { useState, useEffect } from 'react'
import { db } from '../services/firebase'
import { doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore'
import { importSymmetricLinkKey, decryptForLink } from '../crypto/symmetric'
import { PlatformLogo } from './ui/PlatformLogo'
import { getCanonicalPlatformName } from '../utils/platformUtils'
import type { Platform } from '../types'

interface LinkPreviewProps {
  linkId: string
  base64Key: string
  onClose: () => void
}

type LinkPayload =
  | { type: 'single'; senderEmail?: string; identityEmail?: string; data: Platform }
  | { type: 'bundle'; senderEmail?: string; identityEmail: string; data: Platform[] }

// For legacy links that didn't have type wrapper
type ParsedPayload = LinkPayload | Platform

function normalizeParsedPayload(raw: ParsedPayload): LinkPayload {
  if ('type' in raw && (raw.type === 'single' || raw.type === 'bundle')) {
    return raw as LinkPayload
  }
  return { type: 'single', data: raw as Platform }
}

function PlatformCard({ platform, defaultOpen, isSingle }: { platform: Platform; defaultOpen?: boolean; isSingle?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const canonicalName = getCanonicalPlatformName(platform.name)

  const copy = async (text: string, field: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      alert(`No se pudo copiar ${field}.`)
    }
  }

  const togglePassword = (id: string) => {
    setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const renderMethod = (method: any, idx: number) => {
    const isPassword = method.type === 'PASSWORD'
    const isSso = method.type === 'SSO'
    const methodId = method.id || String(idx)
    const showPw = showPasswordMap[methodId]

    return (
      <div key={methodId} className="bg-white border border-border rounded-2xl p-4 shadow-sm mb-3 last:mb-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-100 text-slate-500 rounded-md">
            {isPassword ? 'Contraseña' : isSso ? 'SSO / Social' : method.type}
          </span>
        </div>
        
        {isSso ? (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">Proveedores</label>
              <div className="text-sm font-medium text-text-primary">{(method.providers || []).join(', ')}</div>
            </div>
            {method.email && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">Email de SSO</label>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-text-primary truncate">{method.email}</span>
                  <button onClick={() => copy(method.email, `email-${methodId}`)} className="text-xs font-bold text-text-tertiary hover:text-indigo-600 transition-colors shrink-0">
                    {copiedField === `email-${methodId}` ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {platform.username && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">Usuario / Email</label>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium text-text-primary truncate">{platform.username}</span>
                  <button onClick={() => copy(platform.username!, `user-${methodId}`)} className="text-xs font-bold text-text-tertiary hover:text-indigo-600 transition-colors shrink-0">
                    {copiedField === `user-${methodId}` ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
            {isPassword && method.password && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">Contraseña</label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                  <span className="flex-1 text-sm font-mono text-text-primary truncate tracking-wider">
                    {showPw ? method.password : '••••••••••••'}
                  </span>
                  <button onClick={() => togglePassword(methodId)} className="text-xs font-bold text-text-tertiary hover:text-indigo-600 transition-colors shrink-0">
                    {showPw ? 'Ocultar' : 'Ver'}
                  </button>
                  <button onClick={() => copy(method.password, `pw-${methodId}`)} className="text-xs font-bold text-text-tertiary hover:text-indigo-600 transition-colors shrink-0">
                    {copiedField === `pw-${methodId}` ? '✓' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={isSingle ? '' : "border border-border rounded-2xl overflow-hidden shadow-sm"}>
      {!isSingle && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-surface-hover transition-colors text-left"
        >
          <PlatformLogo name={canonicalName} className="w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">{platform.name}</p>
            <p className="text-xs text-text-tertiary truncate">
              {platform.accessMethods?.length || 0} cuenta{(platform.accessMethods?.length !== 1) ? 's' : ''}
            </p>
          </div>
          <svg className={`w-4 h-4 text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {(open || isSingle) && (
        <div className={isSingle ? '' : "px-3 pb-3 pt-3 bg-slate-50/50 border-t border-border-subtle animate-in slide-in-from-top-1 duration-150"}>
          {(platform.accessMethods || []).map((method: any, idx: number) => renderMethod(method, idx))}
          
          {platform.notes && (
            <div className="mt-3 bg-white border border-border rounded-xl p-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-1">Notas</label>
              <p className="text-xs text-text-secondary whitespace-pre-wrap">{platform.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function LinkPreview({ linkId, base64Key, onClose }: LinkPreviewProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading')
  const [parsedPayload, setParsedPayload] = useState<LinkPayload | null>(null)
  const [isBurnLink, setIsBurnLink] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadLink = async () => {
      try {
        if (!db) throw new Error('Servicios no inicializados.')
        const linkRef = doc(db, 'links', linkId)
        const snap = await getDoc(linkRef)

        if (!snap.exists()) {
          if (isMounted) setStatus('expired')
          return
        }

        const data = snap.data()

        if (data.burned === true) {
          if (isMounted) setStatus('expired')
          return
        }

        if (data.expiresAt && data.expiresAt < Date.now()) {
          if (isMounted) setStatus('expired')
          return
        }

        const key = await importSymmetricLinkKey(base64Key)
        const decryptedString = await decryptForLink(key, data.iv, data.encryptedPayload)
        const raw: ParsedPayload = JSON.parse(decryptedString)
        const normalized = normalizeParsedPayload(raw)

        if (isMounted) {
          setParsedPayload(normalized)
          setIsBurnLink(!!data.burnAfterRead)
          setStatus('success')

          // Track views and devices
          try {
            const userAgent = navigator.userAgent
            // Create a pseudo-anonymous device hash for privacy
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userAgent))
            const deviceHash = Array.from(new Uint8Array(hashBuffer)).map(x => x.toString(16).padStart(2, '0')).join('').substring(0, 16)
            
            await updateDoc(linkRef, {
              viewsCount: increment(1),
              viewedDevices: arrayUnion(deviceHash)
            })
          } catch (e) {
            console.warn('Could not update view stats', e)
          }

          // Burn after read: mark as burned immediately after successful decrypt
          if (data.burnAfterRead && !data.burned) {
            try {
              await updateDoc(linkRef, { burned: true })
            } catch {
              // Non-fatal: Firestore rule might reject if already burned by another client
            }
          }
        }
      } catch (error: any) {
        if (isMounted) {
          console.error(error)
          const msg = error?.message || ''
          if (msg.includes('permission') || msg.includes('no existe') || msg.includes('expired')) {
            setStatus('expired')
          } else {
            setStatus('error')
            setErrorMessage('No se pudo descifrar. El enlace podría ser inválido o estar corrupto.')
          }
        }
      }
    }

    void loadLink()
    return () => { isMounted = false }
  }, [linkId, base64Key])

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-surface overscroll-none">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-text-secondary">Descifrando enlace seguro...</p>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-500">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Enlace expirado</h2>
          <p className="text-sm text-text-secondary mb-8">
            Este enlace ya no está disponible por motivos de seguridad. Si alguien te lo compartió, pídele que genere uno nuevo.
          </p>
          <button onClick={onClose} className="py-3 px-6 bg-text-primary text-white rounded-xl font-bold">
            Volver a la app
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error' || !parsedPayload) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Error de validación</h2>
          <p className="text-sm text-text-secondary mb-8">{errorMessage}</p>
          <button onClick={onClose} className="py-3 px-6 bg-text-primary text-white rounded-xl font-bold">
            Volver a la app
          </button>
        </div>
      </div>
    )
  }

  const isBundle = parsedPayload.type === 'bundle'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-surface rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className={`text-white p-6 text-center relative ${isBundle ? 'bg-gradient-to-br from-indigo-600 to-purple-700' : 'bg-indigo-600'}`}>
          <div className="absolute top-0 right-0 p-4">
            <button onClick={onClose} className="p-2 bg-black/10 rounded-full hover:bg-black/20 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {isBundle ? (
            <>
              <div className="mx-auto w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">{parsedPayload.identityEmail}</h3>
              <p className="text-indigo-100 text-xs mt-1">{parsedPayload.data.length} plataformas compartidas</p>
            </>
          ) : (
            <>
              <PlatformLogo name={getCanonicalPlatformName(parsedPayload.data.name)} className="w-16 h-16 mx-auto mb-3 shadow-lg ring-4 ring-white/20" />
              <h3 className="text-xl font-bold">{parsedPayload.data.name}</h3>
              {parsedPayload.identityEmail && (
                <p className="text-indigo-100 text-sm mt-1">{parsedPayload.identityEmail}</p>
              )}
            </>
          )}

          <div className="flex flex-col items-center justify-center mt-3 gap-2">
            {parsedPayload.senderEmail && (
              <div className="inline-flex items-center gap-1.5 bg-black/10 px-2.5 py-1 rounded-full border border-white/10">
                <svg className="w-3.5 h-3.5 text-indigo-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-[10px] font-bold text-indigo-50 uppercase tracking-wider">
                  Enviado por: <span className="lowercase font-normal tracking-normal">{parsedPayload.senderEmail}</span>
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-indigo-100 text-xs font-medium">
                {isBurnLink ? 'Enlace de Un Solo Uso · Ya consumido 🔥' : 'Zero-Knowledge · Cifrado extremo a extremo'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {isBurnLink && (
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-2.5">
              <span className="text-lg">🔥</span>
              <p className="text-xs text-orange-700 font-medium leading-snug">
                Este enlace era de <strong>un solo uso</strong> y ha sido destruido automáticamente. Guarda la información antes de cerrar esta ventana.
              </p>
            </div>
          )}

          {isBundle ? (
            parsedPayload.data.map((platform, i) => (
              <PlatformCard key={platform.id || i} platform={platform} defaultOpen={i === 0} />
            ))
          ) : (
            <PlatformCard platform={parsedPayload.data} isSingle />
          )}
        </div>
      </div>
    </div>
  )
}
