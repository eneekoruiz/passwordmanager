import { useState, useEffect } from 'react'
import { db, auth } from '../services/firebase'
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { useVault } from '../context/VaultContext'
import { useToast } from './ui/ToastProvider'
import { ConfirmModal } from './ui/ConfirmModal'
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
  viewsCount?: number
  viewedDevices?: string[]
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

function LinkEditModal({ link, onClose }: { link: LinkItem; onClose: () => void }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [expiration, setExpiration] = useState<'1h' | '24h' | '7d' | 'never' | 'burn' | 'custom'>(() => {
    if (link.burnAfterRead) return 'burn'
    if (!link.expiresAt) return 'never'
    const diff = link.expiresAt - Date.now()
    if (diff <= 3600000) return '1h'
    if (diff <= 86400000) return '24h'
    if (diff <= 604800000) return '7d'
    return 'custom'
  })
  const [customExpirationDate, setCustomExpirationDate] = useState(() => {
    if (link.expiresAt) {
      return new Date(link.expiresAt).toISOString().slice(0, 16)
    }
    return ''
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      const burnAfterRead = expiration === 'burn'
      let expiresAt: number | null = null
      if (!burnAfterRead && expiration !== 'never') {
        if (expiration === 'custom') {
          if (!customExpirationDate) throw new Error('Debes seleccionar una fecha y hora.')
          expiresAt = new Date(customExpirationDate).getTime()
          if (expiresAt <= Date.now()) throw new Error('La fecha debe ser en el futuro.')
        } else {
          const hours = expiration === '1h' ? 1 : expiration === '24h' ? 24 : 168
          expiresAt = Date.now() + hours * 60 * 60 * 1000
        }
      }

      if (!db) return
      await updateDoc(doc(db, 'links', link.id), {
        burnAfterRead,
        expiresAt,
        burned: false // reset burn status if changed
      })
      onClose()
    } catch (e: any) {
      showToast('Error al guardar: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Editar Enlace Mágico</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Expiración</label>
            <select
              value={expiration}
              onChange={(e) => setExpiration(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            >
              <option value="burn">Un solo uso (Autodestrucción)</option>
              <option value="1h">1 hora a partir de ahora</option>
              <option value="24h">24 horas a partir de ahora</option>
              <option value="7d">7 días a partir de ahora</option>
              <option value="custom">Expiración personalizada</option>
              <option value="never">Nunca expira</option>
            </select>
          </div>
          
          {expiration === 'custom' && (
            <div className="animate-in slide-in-from-top-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Fecha y Hora de Expiración</label>
              <input
                type="datetime-local"
                value={customExpirationDate}
                onChange={(e) => setCustomExpirationDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}


interface InboxModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InboxModal({ isOpen, onClose }: InboxModalProps) {
  const { currentProfileId } = useVault()
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'links' | 'sent'>('links')
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null)

  const [sentShares, setSentShares] = useState<ShareItem[]>([])
  const [magicLinks, setMagicLinks] = useState<LinkItem[]>([])

  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const currentUser = auth?.currentUser
    if (!db || !currentUser) {
      setLoading(false)
      return
    }

    const uid = currentUser.uid

    setLoading(true)
    let sharesLoaded = false
    let linksLoaded = false

    // 2. Listen to Sent Shares (Outbox P2P)
    const qSent = query(collection(db, 'shares'), where('senderUid', '==', uid))
    const unsubSent = onSnapshot(qSent, (snapshot) => {
      const items: ShareItem[] = []
      snapshot.forEach(d => items.push(d.data() as ShareItem))
      setSentShares(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      sharesLoaded = true
      if (linksLoaded) setLoading(false)
    }, (err) => {
      console.error('Error fetching sent shares:', err)
      sharesLoaded = true
      if (linksLoaded) setLoading(false)
    })

    // 3. Listen to Sent Links (Magic Links)
    const qLinks = query(collection(db, 'links'), where('senderUid', '==', uid))
    const unsubLinks = onSnapshot(qLinks, (snapshot) => {
      const items: LinkItem[] = []
      snapshot.forEach(d => items.push(d.data() as LinkItem))
      setMagicLinks(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      linksLoaded = true
      if (sharesLoaded) setLoading(false)
    }, (err) => {
      console.error('Error fetching magic links:', err)
      linksLoaded = true
      if (sharesLoaded) setLoading(false)
    })

    return () => {
      unsubSent()
      unsubLinks()
    }
  }, [currentProfileId, isOpen])

  const [pendingRevoke, setPendingRevoke] = useState<{ id: string; type: 'share' | 'link' } | null>(null)

  const handleRevokeShare = (shareId: string) => {
    setPendingRevoke({ id: shareId, type: 'share' })
  }

  const handleRevokeLink = (linkId: string) => {
    setPendingRevoke({ id: linkId, type: 'link' })
  }

  const executeRevoke = async () => {
    if (!pendingRevoke) return
    const { id, type } = pendingRevoke
    setPendingRevoke(null)
    
    try {
      setProcessingId(id)
      if (db) {
        await deleteDoc(doc(db, type === 'share' ? 'shares' : 'links', id))
        showToast(type === 'share' ? 'Acceso revocado con éxito' : 'Enlace mágico revocado con éxito', 'success')
      }
    } catch (err: any) {
      console.error(`Error revoking ${type}:`, err)
      showToast(`Error al revocar: ${err.message}`, 'error')
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/30 backdrop-blur-sm animate-vault-fade-in" onClick={onClose}>
      <div 
        className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col dark:bg-[#1c1c1e] dark:border dark:border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] bg-surface-elevated px-6 py-5 dark:border-white/10 dark:bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary dark:text-slate-100">Buzón de Compartidos</h2>
            <p className="text-sm text-text-secondary mt-0.5 dark:text-slate-400">Gestiona contraseñas que has enviado.</p>
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
      <div className="flex border-b border-black/5 mb-6 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('links')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors mr-6 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'links' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <span>Enlaces Mágicos</span>
          {magicLinks.length > 0 && (
            <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">{magicLinks.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'sent' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'
          }`}
        >
          <span>Enviados (P2P)</span>
          {sentShares.length > 0 && (
            <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">{sentShares.length}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
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
                    localLinkUrl = `${base}#/link/${link.id}?key=${keyObj[link.id]}`
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
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 inline-flex w-fit">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          {link.viewsCount || 0} vistas
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          {link.viewedDevices?.length || 0} dispositivos
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 border-t border-black/5 pt-3">
                    <button
                      onClick={() => setEditingLink(link)}
                      disabled={isProcessing}
                      className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-text-secondary py-2 text-xs font-bold transition-all flex items-center justify-center gap-1"
                      title="Editar parámetros del enlace"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => handleRevokeLink(link.id)}
                      disabled={isProcessing}
                      className="flex-1 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <span className="w-4 h-4 border-2 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
                      ) : 'Revocar'}
                    </button>
                    {localLinkUrl && isActive ? (
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(localLinkUrl as string)
                            showToast('¡Enlace copiado al portapapeles!', 'success')
                          } catch (e) {}
                        }}
                        className="flex-none rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-2 text-xs font-bold transition-all flex items-center justify-center"
                        title="Copiar enlace mágico"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </button>
                    ) : isActive && !localLinkUrl ? (
                      <div className="flex-none rounded-xl bg-slate-50 border border-slate-100 text-slate-400 px-2 py-2 text-[9px] font-bold flex items-center justify-center text-center leading-tight max-w-[80px]" title="La clave de descifrado no está disponible en este dispositivo.">
                        Clave no disponible
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {editingLink && (
        <LinkEditModal link={editingLink} onClose={() => setEditingLink(null)} />
      )}

      <ConfirmModal
        isOpen={pendingRevoke !== null}
        title={pendingRevoke?.type === 'share' ? '¿Revocar acceso compartido?' : '¿Revocar enlace mágico?'}
        message={
          pendingRevoke?.type === 'share'
            ? '¿Seguro que deseas revocar este acceso compartido? El destinatario ya no podrá aceptar ni ver esta contraseña.'
            : '¿Seguro que deseas revocar este enlace mágico? Se eliminará permanentemente de internet y nadie podrá volver a acceder a él.'
        }
        confirmLabel="Revocar"
        cancelLabel="Cancelar"
        type="danger"
        onConfirm={executeRevoke}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
      </div>
    </div>
  )
}
