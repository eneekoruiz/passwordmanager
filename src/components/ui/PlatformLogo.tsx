import { useEffect, useMemo, useState } from 'react'
import { POPULAR_SERVICES } from '../../data/popularServices'

interface PlatformLogoProps {
  name: string
  className?: string
}

const SIMPLE_ICON_OVERRIDES: Record<string, string> = {
  '1password': '1password',
  adobe: 'adobe',
  airbnb: 'airbnb',
  amazon: 'amazon',
  'amazon prime video': 'primevideo',
  'amazon web services aws': 'amazonwebservices',
  aws: 'amazonwebservices',
  apple: 'apple',
  'apple music': 'applemusic',
  'apple tv': 'appletv',
  asana: 'asana',
  atlassian: 'atlassian',
  auth0: 'auth0',
  authy: 'authy',
  bbva: 'bbva',
  bereal: 'bereal',
  binance: 'binance',
  bitbucket: 'bitbucket',
  bitwarden: 'bitwarden',
  booking: 'bookingdotcom',
  'booking com': 'bookingdotcom',
  brave: 'brave',
  canva: 'canva',
  carrefour: 'carrefour',
  chatgpt: 'openai',
  'chat gpt': 'openai',
  chrome: 'googlechrome',
  claude: 'anthropic',
  cloudflare: 'cloudflare',
  coinbase: 'coinbase',
  confluence: 'confluence',
  coursera: 'coursera',
  crunchyroll: 'crunchyroll',
  discord: 'discord',
  docker: 'docker',
  dropbox: 'dropbox',
  duolingo: 'duolingo',
  ebay: 'ebay',
  epicgames: 'epicgames',
  'epic games': 'epicgames',
  etsy: 'etsy',
  facebook: 'facebook',
  figma: 'figma',
  firebase: 'firebase',
  garmin: 'garmin',
  gemini: 'googlegemini',
  github: 'github',
  gitlab: 'gitlab',
  glovo: 'glovo',
  google: 'google',
  'google authenticator': 'googleauthenticator',
  authenticator: 'googleauthenticator',
  'google calendar': 'googlecalendar',
  calendar: 'googlecalendar',
  'google cloud': 'googlecloud',
  'google drive': 'googledrive',
  drive: 'googledrive',
  'google keep': 'googlekeep',
  keep: 'googlekeep',
  'google maps': 'googlemaps',
  maps: 'googlemaps',
  'google meet': 'googlemeet',
  meet: 'googlemeet',
  'google photos': 'googlephotos',
  photos: 'googlephotos',
  'google play': 'googleplay',
  'google play store': 'googleplay',
  playstore: 'googleplay',
  'google translate': 'googletranslate',
  'google translator': 'googletranslate',
  'google workspace': 'googleworkspace',
  hbo: 'hbo',
  heroku: 'heroku',
  hubspot: 'hubspot',
  instagram: 'instagram',
  jira: 'jira',
  linkedin: 'linkedin',
  mastodon: 'mastodon',
  microsoft: 'microsoft',
  'microsoft authenticator': 'microsoftauthenticator',
  netflix: 'netflix',
  notion: 'notion',
  openai: 'openai',
  paypal: 'paypal',
  pinterest: 'pinterest',
  proton: 'proton',
  reddit: 'reddit',
  salesforce: 'salesforce',
  slack: 'slack',
  spotify: 'spotify',
  steam: 'steam',
  stripe: 'stripe',
  telegram: 'telegram',
  tiktok: 'tiktok',
  twitch: 'twitch',
  twitter: 'x',
  uber: 'uber',
  vercel: 'vercel',
  whatsapp: 'whatsapp',
  x: 'x',
  youtube: 'youtube',
  zoom: 'zoom',
}

const DOMAIN_OVERRIDES: Record<string, string> = {
  dia: 'dia.es',
  mediaset: 'mediaset.es',
  mitele: 'mitele.es',
  'google authenticator': 'accounts.google.com',
  authenticator: 'accounts.google.com',
  'microsoft authenticator': 'microsoft.com',
}

const MULTIPART_SUFFIXES = new Set(['co.uk', 'com.es', 'com.mx', 'com.ar', 'com.br', 'com.au', 'co.jp'])

function normalizeKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]))
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

function getKnownService(name: string) {
  const key = normalizeKey(name)
  return POPULAR_SERVICES.find((service) => {
    const serviceKeys = [service.name, ...(service.aliases ?? [])].map(normalizeKey)
    return serviceKeys.includes(key)
  })
}

function getDomainFromName(name: string): string | null {
  const key = normalizeKey(name)
  const override = DOMAIN_OVERRIDES[key]
  if (override) return override

  const parsedDomain = normalizeDomain(name)
  if (parsedDomain) return parsedDomain

  const known = getKnownService(name)
  return known ? normalizeDomain(known.domain) : null
}

function toSimpleIconSlugCandidate(value: string): string | null {
  const slug = normalizeKey(value).replace(/\s+/g, '')
  return slug || null
}

function getSimpleIconSlugs(name: string) {
  const key = normalizeKey(name)
  const known = getKnownService(name)
  const names = uniq([
    name,
    key,
    SIMPLE_ICON_OVERRIDES[key],
    known?.name,
    ...(known?.aliases ?? []),
  ])

  return uniq([
    SIMPLE_ICON_OVERRIDES[key],
    ...names.map((item) => SIMPLE_ICON_OVERRIDES[normalizeKey(item)]),
    ...names.map(toSimpleIconSlugCandidate),
  ])
}

function buildSources(name: string) {
  const domain = getDomainFromName(name)
  const encodedDomain = domain ? encodeURIComponent(domain) : null
  const iconSlugs = getSimpleIconSlugs(name)

  return uniq([
    ...iconSlugs.map((slug) => `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`),
    domain && `https://www.google.com/s2/favicons?domain=${encodedDomain}&sz=256`,
    domain && `https://www.google.com/s2/favicons?domain_url=https://${encodedDomain}&sz=256`,
    domain && `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    domain && `https://icon.horse/icon/${domain}`,
    domain && `https://api.faviconkit.com/${domain}/256`,
    domain && `https://unavatar.io/${domain}`,
    domain && `https://${domain}/apple-touch-icon.png`,
    domain && `https://${domain}/favicon.ico`,
    domain && `https://logo.clearbit.com/${domain}?size=256`,
  ])
}

const logoSourceCache = new Map<string, string>()
const rejectedLogoSources = new Map<string, Set<string>>()

function getCachedSource(key: string, sources: string[]) {
  const cached = logoSourceCache.get(key)
  return cached && sources.includes(cached) ? cached : null
}

function getNextSourceIndex(key: string, sources: string[], currentIndex: number) {
  const rejected = rejectedLogoSources.get(key)
  for (let index = currentIndex + 1; index < sources.length; index += 1) {
    if (!rejected?.has(sources[index])) return index
  }
  return -1
}
function GenericLogoIcon() {
  return (
    <svg className="h-[58%] w-[58%] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 7.75A3 3 0 0 1 7.75 4.75h8.5a3 3 0 0 1 3 3v8.5a3 3 0 0 1-3 3h-8.5a3 3 0 0 1-3-3v-8.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6v6H9z" />
    </svg>
  )
}

export function PlatformLogo({ name, className = 'h-5 w-5' }: PlatformLogoProps) {
  const logoKey = useMemo(() => normalizeKey(name), [name])
  const sources = useMemo(() => buildSources(name), [name])
  const cachedSource = useMemo(() => getCachedSource(logoKey, sources), [logoKey, sources])
  const initialSourceIndex = cachedSource ? sources.indexOf(cachedSource) : 0
  const [sourceIndex, setSourceIndex] = useState(initialSourceIndex)
  const [loaded, setLoaded] = useState(Boolean(cachedSource))
  const source = sources[sourceIndex]

  useEffect(() => {
    const cached = getCachedSource(logoKey, sources)
    if (cached) {
      setSourceIndex(sources.indexOf(cached))
      setLoaded(true)
      return
    }

    const rejected = rejectedLogoSources.get(logoKey)
    const firstUsableIndex = sources.findIndex((item) => !rejected?.has(item))
    setSourceIndex(firstUsableIndex)
    setLoaded(false)
  }, [logoKey, sources])

  const markSourceRejected = (badSource: string | undefined) => {
    if (!badSource) return
    const rejected = rejectedLogoSources.get(logoKey) ?? new Set<string>()
    rejected.add(badSource)
    rejectedLogoSources.set(logoKey, rejected)
    if (logoSourceCache.get(logoKey) === badSource) logoSourceCache.delete(logoKey)
    const nextIndex = getNextSourceIndex(logoKey, sources, sourceIndex)
    setLoaded(false)
    setSourceIndex(nextIndex)
  }

  return (
    <span
      className={`${className} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/[0.05] bg-white shadow-sm`}
      aria-hidden="true"
    >
      <span className={`absolute inset-0 flex items-center justify-center bg-slate-50 transition-opacity duration-150 ${loaded ? 'opacity-0' : 'opacity-100'}`}>
        <GenericLogoIcon />
      </span>
      {source && sourceIndex >= 0 && (
        <img
          key={`${logoKey}:${source}`}
          src={source}
          alt=""
          onLoad={(event) => {
            const image = event.currentTarget
            if (image.naturalWidth <= 8 || image.naturalHeight <= 8) {
              markSourceRejected(source)
              return
            }
            logoSourceCache.set(logoKey, source)
            setLoaded(true)
          }}
          onError={() => markSourceRejected(source)}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`absolute inset-0 h-full w-full bg-white object-contain p-[2px] transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </span>
  )
}
