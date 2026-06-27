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
const CUSTOM_ICONS: Record<string, string> = {
  'google authenticator': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleauthenticator.svg',
  'google maps': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googlemaps.svg',
  'google meet': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googlemeet.svg',
  'google play': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleplay.svg',
  'google play store': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleplay.svg',
  'google playstore': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleplay.svg',
  'google translate': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googletranslate.svg',
  'google translator': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googletranslate.svg',
  'google files': 'https://www.google.com/s2/favicons?domain=files.google.com&sz=256',
  'google files go': 'https://www.google.com/s2/favicons?domain=files.google.com&sz=256',
  'zoom': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/zoom.svg',
  'chatgpt': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/openai.svg',
  'chat gpt': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/openai.svg',
  'openai': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/openai.svg',
  'booking.com': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/bookingdotcom.svg',
  'booking': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/bookingdotcom.svg',
}

/**
 * Componente que muestra el logotipo de una plataforma de forma dinámica utilizando
 * el servicio de favicons de Google con un fallback elegante a las iniciales de la plataforma.
 */
export function PlatformLogo({ name, className = 'h-5 w-5' }: PlatformLogoProps) {
  const [hasError, setHasError] = useState(false)
  const [src, setSrc] = useState('')

  const getCustomIcon = (n: string): string | null => {
    const clean = n.trim().toLowerCase()
    
    // Exact or substring match in CUSTOM_ICONS
    if (CUSTOM_ICONS[clean]) return CUSTOM_ICONS[clean]
    
    for (const key of Object.keys(CUSTOM_ICONS)) {
      if (clean.includes(key) || key.includes(clean)) {
        return CUSTOM_ICONS[key]
      }
    }
    return null
  }

  const getDomainFromName = (n: string): string => {
    const clean = n.trim().toLowerCase()
    
    // Substring/Regex mappings requested by user
    if (clean.includes('youtube')) return 'youtube.com'
    if (clean.includes('yubo')) return 'yubo.live'
    if (clean.includes('yuka')) return 'yuka.io'
    
    // Check in POPULAR_SERVICES by name or aliases
    const known = POPULAR_SERVICES.find((service) => {
      const matchName = service.name.toLowerCase() === clean || clean.includes(service.name.toLowerCase())
      const matchAlias = service.aliases?.some(alias => alias.toLowerCase() === clean || clean.includes(alias.toLowerCase()))
      return matchName || matchAlias
    })
    
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
    const custom = getCustomIcon(name)
    if (custom) {
      setSrc(custom)
    } else {
      setSrc(`https://logo.clearbit.com/${domain}?size=512`)
    }
  }, [name, domain])

  const handleImageError = () => {
    if (src.includes('walkxcode') || src.includes('jsdelivr.net')) {
      // Fallback 1 for custom icons -> go to Clearbit
      setSrc(`https://logo.clearbit.com/${domain}?size=512`)
    } else if (src.includes('clearbit.com')) {
      // Fallback 2: icon.horse
      setSrc(`https://icon.horse/icon/${domain}`)
    } else if (src.includes('icon.horse')) {
      // Fallback 3: Google Favicons with default=404 parameter to avoid the default globe icon
      setSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=256`)
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
      loading="lazy"
      decoding="async"
      style={{ imageRendering: 'auto' }}
      className={`${className} rounded-full shrink-0 object-contain bg-white border border-black/[0.05] p-[1px]`}
    />
  )
}
