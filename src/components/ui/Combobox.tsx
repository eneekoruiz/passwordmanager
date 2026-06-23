import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { inputClassName } from './FormField'
import { PlatformLogo } from './PlatformLogo'

interface ComboboxOption {
  label: string
  meta?: string
}

interface ComboboxProps {
  label: string
  value: string
  options: ComboboxOption[]
  onChange: (value: string) => void
  onInputChange?: (value: string) => void
  placeholder?: string
  createLabel?: (value: string) => string
}

function fuzzyScore(option: string, query: string): number {
  const source = option.toLowerCase()
  const target = query.toLowerCase().trim()
  if (!target) return 1
  if (source === target) return 100
  if (source.startsWith(target)) return 80
  if (source.includes(target)) return 60

  let score = 0
  let cursor = 0
  for (const char of target) {
    const index = source.indexOf(char, cursor)
    if (index === -1) return 0
    score += index === cursor ? 6 : 2
    cursor = index + 1
  }
  return score
}

export function Combobox({
  label,
  value,
  options,
  onChange,
  onInputChange,
  placeholder,
  createLabel = (input) => `¿No encuentras tu plataforma? Crear "${input}"`,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const blurTimer = useRef<number | null>(null)
  const trimmedValue = value.trim()

  const filteredOptions = useMemo(
    () =>
      options
        .map((option) => ({ ...option, score: fuzzyScore(option.label, value) }))
        .filter((option) => option.score > 0)
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, 7),
    [options, value],
  )

  const hasExactMatch = options.some((option) => option.label.toLowerCase() === trimmedValue.toLowerCase())
  const showCreate = trimmedValue.length > 0 && !hasExactMatch
  const itemCount = filteredOptions.length + (showCreate ? 1 : 0)

  const chooseValue = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setActiveIndex(0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter')) {
      setOpen(true)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (itemCount ? (index + 1) % itemCount : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (itemCount ? (index - 1 + itemCount) % itemCount : 0))
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (activeIndex < filteredOptions.length) {
        chooseValue(filteredOptions[activeIndex].label)
      } else if (showCreate) {
        chooseValue(trimmedValue)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <label className="relative block">
      <span className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</span>
      <input
        name="vault-platform-search-off"
        id={`combobox-input-${label.replace(/\s+/g, '-').toLowerCase()}`}
        className={`${inputClassName} pr-9`}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          if (onInputChange) {
            onInputChange(nextValue)
          } else {
            onChange(nextValue)
          }
          setOpen(true)
          setActiveIndex(0)
        }}
        onFocus={() => {
          if (blurTimer.current) window.clearTimeout(blurTimer.current)
          setOpen(true)
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck="false"
        autoCorrect="off"
        autoCapitalize="off"
      />
      <span className="pointer-events-none absolute right-3 top-[34px] text-text-tertiary">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9.75L12 13.5l3.75-3.75" />
        </svg>
      </span>

      {open && itemCount > 0 && (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl animate-vault-morph">
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {filteredOptions.map((option, index) => (
              <button
                key={option.label}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseValue(option.label)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                  activeIndex === index ? 'bg-surface-active' : 'hover:bg-surface-hover'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <PlatformLogo name={option.label} className="h-7 w-7 rounded-xl border border-black/[0.04] bg-white p-0.5 shadow-sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text-primary">{option.label}</span>
                    {option.meta && <span className="block truncate text-[10px] font-medium text-text-tertiary">{option.meta}</span>}
                  </span>
                </span>
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseValue(trimmedValue)}
                className={`mt-1 flex w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  activeIndex === filteredOptions.length ? 'bg-text-primary text-white' : 'bg-surface text-text-primary hover:bg-surface-hover'
                }`}
              >
                {createLabel(trimmedValue)}
              </button>
            )}
          </div>
        </div>
      )}
    </label>
  )
}
