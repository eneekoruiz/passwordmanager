import { useTheme, type ThemeMode } from '../../context/ThemeContext'

const options: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Claro', icon: '☀️' },
  { value: 'system', label: 'Sistema', icon: '💻' },
  { value: 'dark', label: 'Oscuro', icon: '🌙' },
]

interface ThemeToggleProps {
  compact?: boolean
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  if (compact) {
    const next: ThemeMode = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    const current = options.find(o => o.value === theme)
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        title={`Tema: ${current?.label}. Pulsa para cambiar.`}
      >
        <span className="text-base leading-none">{current?.icon}</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-surface p-1 dark:border-[#2c2c2e] dark:bg-[#1c1c1e]">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all ${
            theme === opt.value
              ? 'bg-white text-text-primary shadow-sm dark:bg-[#2c2c2e] dark:text-white'
              : 'text-text-tertiary hover:text-text-secondary dark:text-[#6b6b70] dark:hover:text-[#a0a0a5]'
          }`}
          title={opt.label}
        >
          <span className="text-sm">{opt.icon}</span>
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
