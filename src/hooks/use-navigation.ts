import { useCallback, useEffect, useRef, useState } from 'react'
import { asInternal, type InternalSlideIndex } from '../slide-index'

// The URL hash carries 0-based InternalSlideIndex values (`#/0`, `#/1`, ...).
// Agents and CLI consumers see 1-based ExternalSlideNumber — the conversion
// happens at the CLI boundary. See SLIDE_INDEX_DOCS in ../slide-index.ts.
export function useNavigation(totalSlides: number) {
  const initialSlide = (): InternalSlideIndex => {
    if (typeof window === 'undefined') return asInternal(0)
    const hash = window.location.hash.replace('#/', '')
    const n = parseInt(hash, 10)
    return Number.isFinite(n) && n >= 0 && n < totalSlides
      ? asInternal(n)
      : asInternal(0)
  }

  const [current, setCurrent] = useState<InternalSlideIndex>(initialSlide)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)

  const goTo = useCallback(
    (index: number) => {
      const clamped: InternalSlideIndex = asInternal(
        Math.max(0, Math.min(index, totalSlides - 1)),
      )
      setCurrent(clamped)
      window.history.replaceState(null, '', `#/${clamped}`)
    },
    [totalSlides],
  )

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'P') {
        window.open(
          `${window.location.origin}${window.location.pathname}?presenter=true${window.location.hash}`,
          'prez-presenter',
          'width=1200,height=800',
        )
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          prev()
          break
        case 'Home':
          e.preventDefault()
          goTo(0)
          break
        case 'End':
          e.preventDefault()
          goTo(totalSlides - 1)
          break
        case 'f':
        case 'F':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault()
            if (document.fullscreenElement) {
              document.exitFullscreen()
            } else {
              containerRef.current?.requestFullscreen()
            }
          }
          break
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
    }

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (Math.abs(dx) > 50) {
        if (dx < 0) next()
        else prev()
      }
    }

    const onHashChange = () => {
      const hash = window.location.hash.replace('#/', '')
      const n = parseInt(hash, 10)
      if (Number.isFinite(n) && n >= 0 && n < totalSlides) {
        setCurrent(asInternal(n))
      }
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend', onTouchEnd)
    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [next, prev, goTo, totalSlides])

  return { current, goTo, next, prev, containerRef }
}
