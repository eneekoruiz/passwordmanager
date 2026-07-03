import { useState, useEffect } from 'react'
import { db } from '../services/firebase'
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { useVault } from '../context/VaultContext'
import type { Platform } from '../types'
import { PlatformLogo } from './ui/PlatformLogo'

interface ShareItem {
  id: string
  senderEmail: string
  platformName: string
  payloadType?: 'single' | 'bundle'
  encryptedPayload: string
  createdAt: string
  recipientUid: string
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
          <p className="mt-0.5 text-xs font-medium text-text-secondary">
            {isBundle ? 'Identidad completa compartida' : 'Contraseña compartida'}
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

export function InboxArea({ onSavePlatform }: { onSavePlatform: (platform: Platform) => Promise<void> }) {
  const { currentProfileId, getAsymmetricPrivateKey } = useVault()
  const [shares, setShares] = useState<ShareItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    if (!db || !currentProfileId) {
      setLoading(false)
      return
    }

    const q = query(collection(db, 'shares'), where('recipientUid', '==', currentProfileId))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ShareItem[] = []
      snapshot.forEach(d => items.push(d.data() as ShareItem))
      setShares(items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
      setLoading(false)
    }, (err) => {
      console.error('Error fetching shares:', err)
      setError('No se pudo cargar la bandeja de entrada.')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [currentProfileId])

  const handleAccept = async (share: ShareItem) => {
    try {
      setProcessingId(share.id)

      const { importKeyFromJwkString, decryptWithPrivateKey } = await import('../crypto/asymmetric')
      const privateKeyJwk = await getAsymmetricPrivateKey()
      if (!privateKeyJwk) throw new Error('Llave privada no encontrada. La cuenta debe estar desbloqueada.')

      const privateKey = await importKeyFromJwkString(privateKeyJwk, 'private')
      const decryptedString = await decryptWithPrivateKey(privateKey, share.encryptedPayload)
      const parsed = JSON.parse(decryptedString)

      // Handle both single and bundle payloads
      if (parsed.type === 'bundle' && Array.isArray(parsed.data)) {
        for (const platform of parsed.data as Platform[]) {
          await onSavePlatform(platform)
        }
      } else if (parsed.type === 'single' && parsed.data) {
        await onSavePlatform(parsed.data as Platform)
      } else {
        // Legacy single platform (no wrapper)
        await onSavePlatform(parsed as Platform)
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

  if (loading) {
    return (
      <div className="px-4 py-6 lg:px-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xl font-black tracking-tight text-text-primary">Buzón</h2>
          <div className="h-6 w-20 rounded-full bg-slate-100 animate-pulse" />
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

  if (shares.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner">
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h3 className="mb-2 text-xl font-bold tracking-tight text-text-primary">Bandeja Vacía</h3>
        <p className="max-w-[260px] text-sm text-text-secondary">
          No tienes contraseñas compartidas pendientes de aceptar.
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xl font-black tracking-tight text-text-primary">Buzón</h2>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
          {shares.length} {shares.length === 1 ? 'pendiente' : 'pendientes'}
        </span>
      </div>

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
    </div>
  )
}
