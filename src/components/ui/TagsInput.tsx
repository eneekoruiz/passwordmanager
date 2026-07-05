import { useState, KeyboardEvent } from 'react'

interface TagsInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagsInput({ tags, onChange, placeholder = 'Añadir etiqueta y pulsar Enter...' }: TagsInputProps) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const addTag = () => {
    const newTag = inputValue.trim().toLowerCase()
    if (newTag && !tags.includes(newTag)) {
      onChange([...tags, newTag])
    }
    setInputValue('')
  }

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove))
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-text-secondary">Etiquetas</label>
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-border-default bg-surface-primary p-2 transition-colors focus-within:border-black focus-within:ring-2 focus-within:ring-black/5">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="flex items-center gap-1.5 rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-black/[0.08]"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="flex h-4 w-4 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-black/10 hover:text-red-500"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </div>
      <p className="text-[10px] text-text-tertiary">Agrupa y filtra tus contraseñas más fácil. Usa Enter o comas para añadir.</p>
    </div>
  )
}
