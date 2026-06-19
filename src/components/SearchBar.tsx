interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar plataformas…',
  disabled = false,
}: SearchBarProps) {
  return (
    <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-border-subtle bg-surface-elevated py-2.5 pl-9 pr-3 text-base text-text-primary placeholder:text-text-tertiary shadow-subtle outline-none transition-colors focus:border-border focus:ring-1 focus:ring-border/50 disabled:bg-surface/50 disabled:cursor-not-allowed"
        aria-label="Buscar plataformas"
      />
    </div>
  )
}
