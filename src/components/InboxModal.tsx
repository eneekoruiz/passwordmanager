import { useState, useEffect } from 'react'
import { db, auth } from '../services/firebase'
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { useVault } from '../context/VaultContext'
import type { Platform } from '../types'
import { PlatformLogo } from './ui/PlatformLogo'

interface ShareItem {
  id: string
  senderEmail: string
  recipientEmail?: string
  senderUid?: string
  platformName: string
  payloadType?: 'single' | 'bundle'
  encryptedPayload: string
  createdAt: string
  recipientUid: string
}

interface LinkItem {
  id: string
  iv: string
  encryptedPayload: string
  createdAt: string
  expiresAt: number | null
  burnAfterRead: boolean
  burned: boolean
  payloadType?: 'single' | 'bundle'
  platformName: string
  senderUid: string
}

interface ShareCardProps {
  share: ShareItem
  onAccept: (share: ShareItem) => Promise<void>
  onReject: (share: ShareItem) => Promise<void>
  processingId: string | null
}

function ShareCard({ share, onAccept, onReject, processingId }: ShareCardProps) {
  const isProcessing = processingId === share.id
  const [confirmReject, setConfirmReject] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const isBundle = share.payloadType === 'bundle'

  const handleReject = async () => {
    if (!confirmReject) {
      setConfirmReject(true)
      setTimeout(() => setConfirmReject(false), 3000)
      return
    }
    setLeaving(true)
    setTimeout(() => onReject(share), 300)
  }

  return (
    <div
      className={`animate-vault-slide-up relative flex flex-col gap-4 overflow-hidden rounded-2xl border ${
        isBundle ? 'border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white' : 'border-blue-500/10 bg-gradient-to-b from-blue-50/50 to-white'
      } p-5 shadow-lg backdrop-blur transition-all duration-300 ${leaving ? 'opacity-0 scale-95 -translate-y-2' : ''}`}
    >
      {/* Bundle badge */}
      {isBundle && (
        <span className="absolute top-3 right-3 bg-indigo-100 text-indigo-700 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
          Paquete
        </span>
      )}

      <div className="flex items-start gap-4">
        {isBundle ? (
          <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        ) : (
          <PlatformLogo name={share.platformName} className="h-12 w-12 rounded-xl shadow-sm shrink-0" />
        )}
        <div className="flex-1 min-w-0 pr-14">
          <h3 className="truncate text-base font-bold text-text-primary">{share.platformName}</h3>
          <p className="mt-0.5 text-xs font-semibold text-indigo-600 truncate">
            De: {share.senderEmail || 'Usuario Contras'}
          </p>
          <p className="text-[10px] text-text-tertiary mt-1">{new Date(share.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={handleReject}
          disabled={isProcessing}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50 ${
            confirmReject
              ? 'bg-red-500 text-white shadow-md animate-pulse'
              : 'bg-surface-hover text-text-secondary hover:bg-red-50 hover:text-red-600'
          }`}
        >
          {confirmReject ? '¿Seguro? Pulsa de nuevo' : 'Rechazar'}
        </button>
        <button
          onClick={() => onAccept(share)}
          disabled={isProcessing}
          className="flex-1 rounded-xl bg-text-primary py-2.5 text-xs font-bold text-white shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 active:scale-95 flex items-center justify-center gap-1.5"
        >
          {isProcessing ? (
            <>
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Descifrando...
            </>
          ) : (
            'Aceptar y Guardar'
          )}
        </button>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-slate-100 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-2/3 rounded-lg bg-slate-100" />
          <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
          <div className="h-2.5 w-1/3 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-9 rounded-xl bg-slate-100" />
        <div className="flex-1 h-9 rounded-xl bg-slate-100" />
      </div>
    </div>
  )
}

interface InboxModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InboxModal({ isOpen, onClose }: InboxModalProps) {
  const { currentProfileId, getAsymmetricPrivateKey, identities, addPlatform, addIdentity } = useVault()
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'links'>('inbox')

  const [shares, setShares] = useState<ShareItem[]>([])
  const [sentShares, setSentShares] = useState<ShareItem[]>([])
  const [magicLinks, setMagicLinks] = useState<LinkItem[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const currentUser = auth?.currentUser
    if (!db || !currentUser) {
      setLoading(false)
      return
    }

    const uid = currentUser.uid

    // 1. Listen to Received Shares (Inbox)
    const qInbox = query(collection(db, 'shares'), where('recipientUid', '==', uid))
    const unsubInbox = onSnapshot(qInbox, (snapshot) => {
      const items: ShareItem[] = []
      snapshot.forEach(d => items.push(d.data() as ShareItem))
      setShares(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      setLoading(false)
    }, (err) => {
      console.error('Error fetching shares:', err)
      setError('No se pudo cargar la bandeja de entrada.')
      setLoading(false)
    })

    // 2. Listen to Sent Shares (Outbox P2P)
    const qSent = query(collection(db, 'shares'), where('senderUid', '==', uid))
    const unsubSent = onSnapshot(qSent, (snapshot) => {
      const items: ShareItem[] = []
      snapshot.forEach(d => items.push(d.data() as ShareItem))
      setSentShares(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    }, (err) => {
      console.error('Error fetching sent shares:', err)
    })

    // 3. Listen to Sent Links (Magic Links)
    const qLinks = query(collection(db, 'links'), where('senderUid', '==', uid))
    const unsubLinks = onSnapshot(qLinks, (snapshot) => {
      const items: LinkItem[] = []
      snapshot.forEach(d => items.push(d.data() as LinkItem))
      setMagicLinks(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    }, (err) => {
      console.error('Error fetching magic links:', err)
    })

    return () => {
      unsubInbox()
      unsubSent()
      unsubLinks()
    }
  }, [currentProfileId, isOpen])

  const handleAccept = async (share: ShareItem) => {
    try {
      setProcessingId(share.id)

      const privateKeyJwk = await getAsymmetricPrivateKey()
      if (!privateKeyJwk) throw new Error('Llave privada no encontrada. La cuenta debe estar desbloqueada.')

      const { importKeyFromJwkString, decryptWithPrivateKey } = await import('../crypto/asymmetric')
      const privateKey = await importKeyFromJwkString(privateKeyJwk, 'private')
      const decryptedString = await decryptWithPrivateKey(privateKey, share.encryptedPayload)
      const parsed = JSON.parse(decryptedString)

      const handleSavePlatform = async (platform: Platform) => {
        let identityId = identities[0]?.id
        if (!identityId) {
          const newId = await addIdentity('Mis Cuentas')
          identityId = newId.id
        }
        await addPlatform(identityId, platform)
      }

      // Handle both single and bundle payloads
      if (parsed.type === 'bundle' && Array.isArray(parsed.data)) {
        for (const platform of parsed.data as Platform[]) {
          await handleSavePlatform(platform)
        }
      } else if (parsed.type === 'single' && parsed.data) {
        await handleSavePlatform(parsed.data as Platform)
      } else {
        // Legacy single platform (no wrapper)
        await handleSavePlatform(parsed as Platform)
      }

      if (db) await deleteDoc(doc(db, 'shares', share.id))

    } catch (err: any) {
      console.error('Error accepting share:', err)
      alert('Error al descifrar o guardar: ' + (err.message || 'Error desconocido'))
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (share: ShareItem) => {
    try {
      setProcessingId(share.id)
      if (db) await deleteDoc(doc(db, 'shares', share.id))
    } catch (err: any) {
      console.error('Error rejecting share:', err)
      alert('Error al rechazar: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm('¿Seguro que deseas revocar este acceso? El destinatario ya no podrá aceptar esta contraseña.')) return
    try {
      setProcessingId(shareId)
      if (db) await deleteDoc(doc(db, 'shares', shareId))
    } catch (err: any) {
      console.error('Error revoking share:', err)
      alert('Error al revocar: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRevokeLink = async (linkId: string) => {
    if (!confirm('¿Seguro que deseas revocar este enlace? Se eliminará de forma permanente y nadie más podrá acceder.')) return
    try {
      setProcessingId(linkId)
      if (db) await deleteDoc(doc(db, 'links', linkId))
    } catch (err: any) {
      console.error('Error revoking link:', err)
      alert('Error al revocar enlace: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleExtendLink = async (linkId: string, currentExpiresAt: number | null) => {
    try {
      setProcessingId(linkId)
      if (!db) return
      
      let newExpiresAt: number
      if (!currentExpiresAt || currentExpiresAt < Date.now()) {
        // Expirado o ilimitado -> alargar 24h a partir de ahora
        newExpiresAt = Date.now() + 24 * 60 * 60 * 1000
      } else {
        // Alargar 24h sobre el tiempo restante
        newExpiresAt = currentExpiresAt + 24 * 60 * 60 * 1000
      }

      await updateDoc(doc(db, 'links', linkId), {
        expiresAt: newExpiresAt,
        burned: false
      })
    } catch (err: any) {
      console.error('Error extending link:', err)
      alert('Error al alargar el acceso: ' + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  if (!isOpen) return null

  if (loading) {
    return (
      <div className="px-4 py-6 lg:px-8 animate-pulse">
        <div className="mb-6 flex items-baseline justify-between">
          <div className="h-6 w-32 rounded-lg bg-slate-100" />
          <div className="h-6 w-20 rounded-full bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center bg-red-50 p-6 rounded-3xl border border-red-100 max-w-sm">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-bold text-red-900">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/30 backdrop-blur-sm animate-vault-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl bg-surface-primary shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] bg-surface-elevated px-6 py-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary">Buzón de Compartidos</h2>
            <p className="text-sm text-text-secondary mt-0.5">Gestiona contraseñas que has recibido o enviado.</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-black/5 hover:text-text-primary"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">

      {/* Tabs */}
      <div className="flex border-b border-black/5 mb-6">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors mr-6 flex items-center gap-1.5 ${
            activeTab === 'inbox' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <span>Recibidos</span>
          {shares.length > 0 && (
            <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">{shares.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors mr-6 flex items-center gap-1.5 ${
            activeTab === 'sent' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <span>Enviados P2P</span>
          {sentShares.length > 0 && (
            <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">{sentShares.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('links')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'links' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <span>Enlaces Mágicos</span>
          {magicLinks.length > 0 && (
            <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">{magicLinks.length}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'inbox' && (
        shares.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center animate-in fade-in duration-300">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-text-primary">Bandeja Vacía</h3>
            <p className="max-w-[240px] text-xs text-text-tertiary mt-1">No tienes contraseñas compartidas pendientes de aceptar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {shares.map((share, index) => (
              <div key={share.id} style={{ animationDelay: `${index * 50}ms` }}>
                <ShareCard
                  share={share}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  processingId={processingId}
                />
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'sent' && (
        sentShares.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center animate-in fade-in duration-300">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-text-primary">Sin envíos directos</h3>
            <p className="max-w-[240px] text-xs text-text-tertiary mt-1">Aún no has enviado contraseñas directamente a otros usuarios de Contras.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {sentShares.map((share, index) => {
              const isBundle = share.payloadType === 'bundle'
              const isProcessing = processingId === share.id
              return (
                <div
                  key={share.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="animate-vault-slide-up relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    {isBundle ? (
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    ) : (
                      <PlatformLogo name={share.platformName} className="h-12 w-12 rounded-xl shadow-sm shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="truncate text-base font-bold text-text-primary">{share.platformName}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-indigo-600 truncate">
                        Para: {share.recipientEmail || 'Usuario Contras'}
                      </p>
                      <p className="text-[10px] text-text-tertiary mt-1">Enviado: {new Date(share.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleRevokeShare(share.id)}
                      disabled={isProcessing}
                      className="w-full rounded-xl bg-red-50 hover:bg-red-100 text-red-600 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <span className="w-4 h-4 border-2 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
                      ) : 'Revocar Acceso'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {activeTab === 'links' && (
        magicLinks.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center text-center animate-in fade-in duration-300">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-text-primary">Sin enlaces activos</h3>
            <p className="max-w-[240px] text-xs text-text-tertiary mt-1">Aún no has generado enlaces mágicos públicos para compartir.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {magicLinks.map((link, index) => {
              const isBundle = link.payloadType === 'bundle'
              const isBurned = link.burned
              const isExpired = link.expiresAt ? link.expiresAt < Date.now() : false
              const isActive = !isBurned && !isExpired
              const isProcessing = processingId === link.id

              let localLinkUrl = null
              try {
                const keysStr = localStorage.getItem('contras_magic_keys')
                if (keysStr) {
                  const keyObj = JSON.parse(keysStr)
                  if (keyObj[link.id]) {
                    const base = window.location.href.split('#')[0]
                    localLinkUrl = `${base}#/link/${link.id}#${keyObj[link.id]}`
                  }
                }
              } catch (e) {}

              return (
                <div
                  key={link.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="animate-vault-slide-up relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/5 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    {isBundle ? (
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    ) : (
                      <PlatformLogo name={link.platformName} className="h-12 w-12 rounded-xl shadow-sm shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="truncate text-base font-bold text-text-primary">{link.platformName}</h3>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {link.burnAfterRead && (
                          <span className="bg-orange-100 text-orange-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Un solo uso
                          </span>
                        )}
                        {isActive ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Activo
                          </span>
                        ) : isBurned ? (
                          <span className="bg-orange-100 text-orange-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Quemado 🔥
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Expirado ⌛
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-tertiary mt-2">
                        Creado: {new Date(link.createdAt).toLocaleString()}
                      </p>
                      {link.expiresAt && (
                        <p className="text-[10px] text-text-tertiary mt-0.5">
                          Expira: {new Date(link.expiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 border-t border-black/5 pt-3">
                    {link.expiresAt !== null && (
                      <button
                        onClick={() => handleExtendLink(link.id, link.expiresAt)}
                        disabled={isProcessing}
                        className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-text-secondary py-2 text-xs font-bold transition-all flex items-center justify-center gap-1"
                        title="Añadir 24 horas de acceso"
                      >
                        {isProcessing ? (
                          <span className="w-3 h-3 border-2 border-slate-400/20 border-t-slate-600 rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            <span>+24h</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleRevokeLink(link.id)}
                      disabled={isProcessing}
                      className="flex-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <span className="w-4 h-4 border-2 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
                      ) : 'Revocar'}
                    </button>
                    {localLinkUrl && isActive && (
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(localLinkUrl as string)
                            showToast('Enlace copiado al portapapeles', 'success')
                          } catch {
                            showToast('Error al copiar el enlace', 'error')
                          }
                        }}
                        className="flex-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        title="Copiar enlace mágico"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                        </svg>
                        <span>Copiar</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
      </div>
    </div>
  )
}
