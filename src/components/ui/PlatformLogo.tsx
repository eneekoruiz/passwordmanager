import { useEffect, useState } from 'react'
import { POPULAR_SERVICES } from '../../data/popularServices'

interface PlatformLogoProps {
  name: string
  className?: string
}

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
  'bg-slate-600 text-white',
  'bg-cyan-500 text-white',
]

const CUSTOM_ICONS: Record<string, string> = {
  'google authenticator': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleauthenticator.svg',
  'microsoft authenticator': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/microsoftauthenticator.svg',
  'google maps': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googlemaps.svg',
  'google meet': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googlemeet.svg',
  'google play': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleplay.svg',
  'google play store': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleplay.svg',
  'google playstore': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googleplay.svg',
  'google translate': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googletranslate.svg',
  'google translator': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/googletranslate.svg',
  'chatgpt': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/openai.svg',
  'chat gpt': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/openai.svg',
  openai: 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/openai.svg',
  'booking.com': 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/bookingdotcom.svg',
  booking: 'https://cdn.jsdelivr.net/npm/simple-icons@12.0.0/icons/bookingdotcom.svg',
}

const DOMAIN_OVERRIDES: Record<string, string> = {
  mediaset: 'mediaset.es',
  mitele: 'mitele.es',
  'google authenticator': 'accounts.google.com',
  'microsoft authenticator': 'microsoft.com',
}

const MULTIPART_SUFFIXES = new Set(['co.uk', 'com.es', 'com.mx', 'com.ar', 'com.br', 'com.au', 'co.jp'])

function getDeterministicColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function normalizeDomain(value: string): string | null {
  const clean = value.trim().toLowerCase().replace(/^@/, '')
  if (!clean) return null

  try {
    const url = new URL(clean.match(/^https?:\/\//) ? clean : `https://${clean}`)
    const host = url.hostname.replace(/^www\./, '')
    if (!host.includes('.') || host === 'localhost') return null

    const parts = host.split('.').filter(Boolean)
    if (parts.length <= 2) return host

    const suffix = parts.slice(-2).join('.')
    if (MULTIPART_SUFFIXES.has(suffix) && parts.length >= 3) {
      return parts.slice(-3).join('.')
    }
    return parts.slice(-2).join('.')
  } catch {
    return null
  }
}

function getCustomIcon(name: string): string | null {
  return CUSTOM_ICONS[name.trim().toLowerCase()] ?? null
}

function getDomainFromName(name: string): string | null {
  const clean = name.trim().toLowerCase()
  if (!clean) return null

  const override = DOMAIN_OVERRIDES[clean]
  if (override) return override

  const parsedDomain = normalizeDomain(clean)
  if (parsedDomain) return parsedDomain

  const known = POPULAR_SERVICES.find((service) => {
    const serviceName = service.name.toLowerCase()
    const aliases = service.aliases?.map((alias) => alias.toLowerCase()) ?? []
    return clean === serviceName || aliases.includes(clean)
  })

  return known ? normalizeDomain(known.domain) : null
}

function getInitials(name: string): string {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9\s]/g, '')
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase() || 'P'
}

function buildSources(name: string) {
  const customIcon = getCustomIcon(name)
  const domain = getDomainFromName(name)
  if (!domain) return customIcon ? [customIcon] : []

  const encodedDomain = encodeURIComponent(domain)
  return [
    customIcon,
    `https://www.google.com/s2/favicons?domain=${encodedDomain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://logo.clearbit.com/${domain}?size=128`,
  ].filter(Boolean) as string[]
}

export function PlatformLogo({ name, className = 'h-5 w-5' }: PlatformLogoProps) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const sources = buildSources(name)
  const source = sources[sourceIndex]
  const initials = getInitials(name)
  const colorClass = getDeterministicColor(name || initials)

  useEffect(() => {
    setSourceIndex(0)
    setLoaded(false)
  }, [name])

  useEffect(() => {
    setLoaded(false)
    if (!source) return

    const timer = window.setTimeout(() => {
      setSourceIndex((index) => index + 1)
    }, 3500)
    return () => window.clearTimeout(timer)
  }, [source])

  const fallback = (
    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold tracking-wider">
      {initials}
    </span>
  )

  return (
    <span
      className={`${className} relative inline-flex shrink-0 overflow-hidden rounded-full border border-black/[0.05] ${colorClass} shadow-sm`}
      aria-hidden="true"
    >
      {fallback}
      {source && (
        <img
          src={source}
          alt=""
          onLoad={(event) => {
            const image = event.currentTarget
            if (image.naturalWidth <= 4 || image.naturalHeight <= 4) {
              setSourceIndex((index) => index + 1)
              return
            }
            setLoaded(true)
          }}
          onError={() => setSourceIndex((index) => index + 1)}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full bg-white object-contain p-[2px] transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </span>
  )
}
