import { useState, useEffect } from 'react'
import { POPULAR_SERVICES } from '../../data/popularServices'

interface PlatformLogoProps {
  name: string
  className?: string
}

// Deterministic background colors for initials avatars
const AVATAR_COLORS = [
  'bg-red-500 text-white',
  'bg-pink-500 text-white',
  'bg-purple-500 text-white',
  'bg-indigo-500 text-white',
  'bg-blue-500 text-white',
  'bg-teal-500 text-white',
  'bg-emerald-500 text-white',
  'bg-green-500 text-white',
  'bg-yellow-500 text-slate-900',
  'bg-orange-500 text-white',
  'bg-slate-500 text-white',
  'bg-cyan-500 text-white'
]

function getDeterministicColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[index]
}

/**
 * Componente que muestra el logotipo de una plataforma de forma dinámica utilizando
 * el servicio de favicons de Google con un fallback elegante a las iniciales de la plataforma.
 */
export function PlatformLogo({ name, className = 'h-5 w-5' }: PlatformLogoProps) {
  const [hasError, setHasError] = useState(false)
  const [src, setSrc] = useState('')

  const getDomainFromName = (n: string): string => {
    const clean = n.trim().toLowerCase()
    
    // Substring/Regex mappings requested by user
    if (clean.includes('youtube')) return 'youtube.com'
    if (clean.includes('yubo')) return 'yubo.live'
    if (clean.includes('yuka')) return 'yuka.io'
    
    const known = POPULAR_SERVICES.find((service) => service.name.toLowerCase() === clean)
    if (known) return known.domain
    if (clean.includes('.')) return clean
    // Remover caracteres especiales y espacios
    const sanitized = clean.replace(/[^a-z0-9]/g, '')
    return sanitized ? `${sanitized}.com` : 'example.com'
  }

  const domain = getDomainFromName(name)
  
  // Extract up to 2 initials
  const initials = (() => {
    const cleaned = name.trim().replace(/[^a-zA-Z0-9\s]/g, '')
    const parts = cleaned.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
    }
    return cleaned.slice(0, 2).toUpperCase() || 'P'
  })()

  // Resetear el estado de error y establecer src inicial si el nombre de la plataforma cambia
  useEffect(() => {
    setHasError(false)
    setSrc(`https://logo.clearbit.com/${domain}`)
  }, [name, domain])

  const handleImageError = () => {
    if (src === `https://logo.clearbit.com/${domain}`) {
      setSrc(`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`)
    } else if (src === `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`) {
      setSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)
    } else {
      setHasError(true)
    }
  }

  if (hasError || !src) {
    const colorClass = getDeterministicColor(name)
    return (
      <div
        className={`${className} rounded-full flex items-center justify-center ${colorClass} text-[10px] font-extrabold tracking-wider shrink-0 select-none border border-black/[0.03] shadow-sm`}
        aria-hidden="true"
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`Logo de ${name}`}
      onError={handleImageError}
      className={`${className} rounded-full shrink-0 object-contain bg-white border border-black/[0.05] p-[1px]`}
    />
  )
}
