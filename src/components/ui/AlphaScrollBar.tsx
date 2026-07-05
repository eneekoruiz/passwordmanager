import { useRef, useState, useCallback } from 'react'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

interface AlphaScrollBarProps {
  /** Map of letter -> element ref to scroll to */
  onLetterSelect: (letter: string) => void
  /** Currently visible letter */
  activeLetter?: string
  /** Which letters have content */
  availableLetters: Set<string>
}

export function AlphaScrollBar({ onLetterSelect, activeLetter, availableLetters }: AlphaScrollBarProps) {
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const getLetterFromY = useCallback((clientY: number): string | null => {
    const bar = barRef.current
    if (!bar) return null
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const index = Math.floor(ratio * LETTERS.length)
    return LETTERS[Math.min(index, LETTERS.length - 1)] ?? null
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    const letter = getLetterFromY(e.clientY)
    if (letter && letter !== hovered) {
      setHovered(letter)
      onLetterSelect(letter)
    }
  }, [dragging, hovered, getLetterFromY, onLetterSelect])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const letter = getLetterFromY(e.clientY)
    if (letter) {
      setHovered(letter)
      onLetterSelect(letter)
    }
  }, [getLetterFromY, onLetterSelect])

  const handlePointerUp = useCallback(() => {
    setDragging(false)
    setHovered(null)
  }, [])

  return (
    <div
      ref={barRef}
      className="absolute right-0 top-0 flex h-full w-6 flex-col items-center justify-around py-2 select-none z-10"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Active letter tooltip */}
      {(dragging || hovered) && hovered && (
        <div className="pointer-events-none absolute right-8 flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white shadow-2xl dark:bg-white dark:text-black"
          style={{ top: `${(LETTERS.indexOf(hovered) / LETTERS.length) * 100}%`, transform: 'translateY(-50%)' }}
        >
          <span className="text-lg font-bold">{hovered}</span>
        </div>
      )}

      {LETTERS.map((letter) => {
        const isActive = letter === activeLetter
        const isHovered = letter === hovered
        const hasContent = availableLetters.has(letter)

        return (
          <button
            key={letter}
            type="button"
            data-alpha={letter}
            onClick={() => onLetterSelect(letter)}
            className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold transition-all leading-none
              ${isActive || isHovered
                ? 'scale-110 text-black dark:text-white'
                : hasContent
                  ? 'text-text-tertiary hover:text-text-primary dark:text-[#6b6b70] dark:hover:text-white'
                  : 'text-text-tertiary/30 dark:text-[#3a3a3c] pointer-events-none'
              }`}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
