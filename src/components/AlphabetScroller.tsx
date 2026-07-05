import { useEffect, useState, useRef } from 'react'

interface AlphabetScrollerProps {
  letters: string[]
  onLetterSelect: (letter: string) => void
}

export function AlphabetScroller({ letters, onLetterSelect }: AlphabetScrollerProps) {
  const [activeLetter, setActiveLetter] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handlePointer = (e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return
    e.preventDefault()
    
    // Find the element at the pointer's coordinates
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement
    if (el && el.dataset.letter) {
      const letter = el.dataset.letter
      if (letter !== activeLetter) {
        setActiveLetter(letter)
        onLetterSelect(letter)
      }
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onPointerMove = (e: PointerEvent) => handlePointer(e)
    const onPointerUp = () => setActiveLetter(null)
    
    // Solo escuchar el touch/move cuando estemos arrastrando
    el.addEventListener('pointermove', onPointerMove, { passive: false })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    
    return () => {
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [activeLetter, onLetterSelect])

  if (letters.length === 0) return null

  return (
    <div 
      ref={containerRef}
      className="absolute right-0 top-16 bottom-0 z-40 hidden sm:flex flex-col items-center justify-center px-2 py-4 touch-none select-none"
      onPointerDown={(e) => {
        const el = e.target as HTMLElement
        if (el.dataset.letter) {
          setActiveLetter(el.dataset.letter)
          onLetterSelect(el.dataset.letter)
          el.releasePointerCapture(e.pointerId)
        }
      }}
    >
      <div className="flex flex-col items-center justify-center bg-white/60 backdrop-blur-md border border-black/5 rounded-full px-1.5 py-2 shadow-sm">
        {letters.map(letter => (
          <div
            key={letter}
            data-letter={letter}
            className={`text-[9px] font-bold py-[3px] px-1 cursor-pointer transition-colors ${activeLetter === letter ? 'text-indigo-600 scale-125' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {letter}
          </div>
        ))}
      </div>
      {activeLetter && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-black/60 backdrop-blur-md rounded-2xl flex items-center justify-center pointer-events-none animate-fade-in shadow-xl">
          <span className="text-4xl font-bold text-white">{activeLetter}</span>
        </div>
      )}
    </div>
  )
}
