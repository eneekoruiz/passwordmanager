import { useState, FormEvent } from 'react'
import type { Platform, Identity } from '../types'
import { db, auth } from '../services/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { hashEmailForDirectory } from '../utils/security'
import { generateId } from '../utils/id'
import { generateSymmetricLinkKey, encryptForLink } from '../crypto/symmetric'

export type SharePayload =
  | { type: 'single'; platform: Platform }
  | { type: 'bundle'; identity: Identity; platforms: Platform[] }

interface ShareModalProps {
  payload: SharePayload
  onClose: () => void
}

type ShareMode = 'p2p' | 'link'
type ExpirationType = '1h' | '24h' | '7d' | 'never' | 'burn'

function payloadLabel(payload: SharePayload): string {
  if (payload.type === 'single') return payload.platform.name
  return `${payload.identity.email} (${payload.platforms.length} plataformas)`
}

function buildPayloadString(payload: SharePayload): string {
  if (payload.type === 'single') {
    return JSON.stringify({
      type: 'single',
      data: { ...payload.platform, id: generateId(), identityId: undefined }
    })
  }
  return JSON.stringify({
    type: 'bundle',
    identityEmail: payload.identity.email,
    data: payload.platforms.map(p => ({ ...p, id: generateId(), identityId: undefined }))
  })
}

export function ShareModal({ payload, onClose }: ShareModalProps) {
  const [mode, setMode] = useState<ShareMode>('link')

  // P2P State
  const [email, setEmail] = useState('')
  const [p2pStatus, setP2pStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [p2pErrorMessage, setP2pErrorMessage] = useState('')

  // Link State
  const [expiration, setExpiration] = useState<ExpirationType>('24h')
  const [linkStatus, setLinkStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [linkErrorMessage, setLinkErrorMessage] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  const handleP2PShare = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) return

    setP2pStatus('loading')
    setP2pErrorMessage('')

    try {
      if (!db) throw new Error('Firebase no está inicializado.')

      const emailHash = await hashEmailForDirectory(email)
      const directoryRef = doc(db, 'directory', emailHash)
      const directorySnap = await getDoc(directoryRef)

      if (!directorySnap.exists()) {
        setP2pStatus('error')
        setP2pErrorMessage('Este correo no está registrado en Contras o no tiene sincronización en la nube activa.')
        return
      }

      const recipientUid = directorySnap.data()?.uid
      if (!recipientUid) throw new Error('Datos del directorio corruptos.')

      const publicKeyRef = doc(db, 'publicKeys', recipientUid)
      const publicKeySnap = await getDoc(publicKeyRef)

      if (!publicKeySnap.exists()) {
        setP2pStatus('error')
        setP2pErrorMessage('El destinatario aún no ha generado sus llaves de cifrado.')
        return
      }

      const recipientPublicKeyJwk = publicKeySnap.data()?.publicKey
      const { importKeyFromJwkString, encryptWithPublicKey } = await import('../crypto/asymmetric')
      const publicKey = await importKeyFromJwkString(recipientPublicKeyJwk, 'public')
      const payloadString = buildPayloadString(payload)
      const encryptedData = await encryptWithPublicKey(publicKey, payloadString)

      const shareId = generateId()
      const label = payload.type === 'single' ? payload.platform.name : `Bundle: ${payload.identity.email}`
      const currentUser = auth?.currentUser
      await setDoc(doc(db, 'shares', shareId), {
        id: shareId,
        recipientUid,
        recipientEmail: email,
        senderUid: currentUser?.uid || 'anonymous',
        senderEmail: currentUser?.email || 'usuario-anonimo',
        platformName: label,
        payloadType: payload.type,
        encryptedPayload: encryptedData,
        createdAt: new Date().toISOString()
      })

      setP2pStatus('success')
    } catch (error: any) {
      console.error('Error sharing p2p:', error)
      setP2pStatus('error')
      setP2pErrorMessage(error.message || 'Error desconocido al intentar compartir.')
    }
  }

  const handleLinkShare = async (e: FormEvent) => {
    e.preventDefault()
    setLinkStatus('loading')
    setLinkErrorMessage('')

    try {
      if (!db) throw new Error('Firebase no está inicializado.')

      const { key, base64Key } = await generateSymmetricLinkKey()
      const payloadString = buildPayloadString(payload)
      const { iv, ciphertext } = await encryptForLink(key, payloadString)

      const burnAfterRead = expiration === 'burn'
      let expiresAt: number | null = null
      if (!burnAfterRead && expiration !== 'never') {
        const hours = expiration === '1h' ? 1 : expiration === '24h' ? 24 : 168
        expiresAt = Date.now() + hours * 60 * 60 * 1000
      }

      const linkId = generateId()
      const label = payload.type === 'single' ? payload.platform.name : `${payload.identity.email} (${payload.platforms.length} cuentas)`
      const currentUser = auth?.currentUser
      await setDoc(doc(db, 'links', linkId), {
        id: linkId,
        iv,
        encryptedPayload: ciphertext,
        createdAt: new Date().toISOString(),
        expiresAt,
        burnAfterRead,
        burned: false,
        payloadType: payload.type,
        platformName: label,
        senderUid: currentUser?.uid || 'anonymous'
      })

      const base = window.location.href.split('#')[0]
      const url = `${base}#/link/${linkId}#${base64Key}`
      setGeneratedLink(url)
      setLinkStatus('success')
    } catch (error: any) {
      console.error('Error generating link:', error)
      setLinkStatus('error')
      setLinkErrorMessage(error.message || 'Error desconocido al intentar generar el enlace.')
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert('No se pudo copiar. Selecciona el texto manualmente.')
    }
  }

  const label = payloadLabel(payload)
  const isBundle = payload.type === 'bundle'

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <header className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-white/50">
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              {isBundle ? 'Compartir Identidad' : 'Compartir Plataforma'}
            </h3>
            <p className="text-xs text-text-tertiary truncate max-w-[260px]">
              {isBundle
                ? <><span className="font-semibold text-text-secondary">{label}</span></>
                : <>Envía <b>{label}</b> de forma encriptada.</>
              }
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-hover rounded-full text-text-tertiary hover:text-text-primary transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-black/5 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${mode === 'link' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
          >
            Enlace Mágico
          </button>
          <button
            type="button"
            onClick={() => setMode('p2p')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${mode === 'p2p' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
          >
            Usuario Contras
          </button>
        </div>

        {/* Bundle badge */}
        {isBundle && (
          <div className="mx-6 mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-xs text-indigo-800 font-medium leading-snug">
              Compartirás <strong>{payload.platforms.length} plataformas</strong> de la identidad <strong>{payload.identity.email}</strong> como un paquete cifrado.
            </p>
          </div>
        )}

        {/* LINK MODE */}
        {mode === 'link' && (
          <form onSubmit={handleLinkShare} className={`p-6 ${isBundle ? 'pt-4' : ''} bg-indigo-50/20`}>
            {linkStatus === 'success' ? (
              <div className="text-center py-2 animate-in slide-in-from-bottom-2">
                <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                  {expiration === 'burn' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                </div>
                <h4 className="text-lg font-bold text-text-primary">¡Enlace Generado!</h4>
                <p className="mt-1 text-sm text-text-secondary">
                  {expiration === 'burn'
                    ? 'Este enlace se autodestruirá en cuanto el destinatario lo abra por primera vez. 🔥'
                    : 'Cualquiera con este enlace podrá ver la contraseña hasta que expire.'}
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-lg text-xs font-mono text-text-secondary outline-none"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${copied ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {copied ? '✓ Enlace Copiado' : 'Copiar Enlace'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                  Genera un enlace con la <b>llave de cifrado en la URL</b>. Ni siquiera nuestros servidores podrán ver las contraseñas.
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">
                    Modo de expiración
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: '1h', label: '1 hora' },
                      { value: '24h', label: '24 horas' },
                      { value: '7d', label: '7 días' },
                      { value: 'never', label: 'Sin límite' },
                      { value: 'burn', label: '🔥 Un solo uso', full: true },
                    ] as Array<{ value: ExpirationType; label: string; full?: boolean }>).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setExpiration(opt.value)}
                        className={`${opt.full ? 'col-span-2' : ''} py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                          expiration === opt.value
                            ? opt.value === 'burn'
                              ? 'border-orange-400 bg-orange-50 text-orange-700'
                              : 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-black/8 bg-white text-text-secondary hover:border-black/15'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {expiration === 'burn' && (
                    <p className="mt-2 text-xs text-orange-600 font-medium">
                      El enlace se borrará automáticamente de nuestros servidores después de ser visto una vez.
                    </p>
                  )}
                </div>

                {linkStatus === 'error' && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-100">
                    {linkErrorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={linkStatus === 'loading'}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 hover:-translate-y-0.5 hover:shadow-lg shadow-indigo-200"
                >
                  {linkStatus === 'loading' ? (
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Generar Enlace Seguro
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        )}

        {/* P2P MODE */}
        {mode === 'p2p' && (
          <form onSubmit={handleP2PShare} className="p-6">
            {p2pStatus === 'success' ? (
              <div className="text-center py-6 animate-in slide-in-from-bottom-2">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-text-primary">
                  {isBundle ? '¡Paquete Enviado!' : '¡Contraseña Compartida!'}
                </h4>
                <p className="mt-2 text-sm text-text-secondary">
                  Se ha enviado de forma encriptada a <b>{email}</b>. Deberá aceptarlo desde su Buzón.
                </p>
                <button type="button" onClick={onClose} className="mt-6 w-full py-3 bg-text-primary text-white rounded-xl font-bold transition-transform active:scale-95 hover:-translate-y-0.5 hover:shadow-lg">
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2">
                    Correo electrónico del destinatario
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="ejemplo@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl outline-none focus:border-text-primary focus:ring-1 focus:ring-text-primary transition-all text-sm font-medium"
                  />
                  <p className="mt-2 text-xs text-text-tertiary">El destinatario debe tener una cuenta en Contras con sync en la nube.</p>
                </div>

                {p2pStatus === 'error' && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-100">
                    {p2pErrorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={p2pStatus === 'loading' || !email.includes('@')}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-text-primary text-white rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {p2pStatus === 'loading' ? (
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      {isBundle ? 'Enviar Paquete Encriptado' : 'Enviar Encriptado'}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
