import { useState, useEffect, useRef } from 'react'

interface InputModalProps {
  isOpen: boolean
  title: string
  message?: string
  initialValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  checkboxLabel?: string
  onConfirm: (value: string, checked: boolean) => void
  onCancel: () => void
}

export function InputModal({
  isOpen,
  title,
  message,
  initialValue = '',
  placeholder = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  checkboxLabel,
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [value, setValue] = useState(initialValue)
  const [isChecked, setIsChecked] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, initialValue])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-premium overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <h3 className="text-xl font-bold tracking-tight text-text-primary dark:text-white mb-2">{title}</h3>
        {message && <p className="text-sm text-text-secondary dark:text-[#a0a0a5] mb-5 leading-relaxed">{message}</p>}
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              onConfirm(value.trim(), isChecked)
            } else if (e.key === 'Escape') {
              onCancel()
            }
          }}
          className={`w-full rounded-2xl border border-black/10 bg-slate-50/50 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-black/20 focus:bg-white focus:ring-4 focus:ring-black/5 dark:border-white/10 dark:bg-black/20 dark:text-white dark:focus:border-white/20 dark:focus:bg-[#1c1c1e] dark:focus:ring-white/5 ${checkboxLabel ? 'mb-4' : 'mb-6'}`}
        />

        {checkboxLabel && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 p-3 shadow-sm dark:border-red-500/30 dark:bg-slate-800">
            <div>
              <p className="text-sm font-semibold text-red-900">{checkboxLabel}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-red-800/75">
                La categoría quedará solo en este dispositivo y no subirá a Firebase.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center ml-3">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-red-300"></div>
            </label>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-text-secondary hover:bg-slate-100 transition-colors dark:text-[#a0a0a5] dark:hover:bg-slate-800"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              if (value.trim()) onConfirm(value.trim(), isChecked)
            }}
            disabled={!value.trim()}
            className="vault-button-primary rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
