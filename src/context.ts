import { createContext, useContext } from 'react'

export interface DeckContextValue {
  currentSlide: number
  totalSlides: number
  next: () => void
  prev: () => void
  goTo: (index: number) => void
}

export const DeckContext = createContext<DeckContextValue | null>(null)

export function useDeck(): DeckContextValue {
  const ctx = useContext(DeckContext)
  if (!ctx) throw new Error('useDeck must be used inside <Deck>')
  return ctx
}
