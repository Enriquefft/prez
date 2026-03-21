import React, {
  Children,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { DeckContext } from '../context'
import { useNavigation } from '../hooks/use-navigation'
import { usePresenter } from '../hooks/use-presenter'
import { Presenter } from '../presenter/Presenter'
import { Notes } from './Notes'

function flattenChildren(children: ReactNode): ReactElement[] {
  const result: ReactElement[] = []
  Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === React.Fragment) {
      result.push(
        ...flattenChildren((child.props as { children?: ReactNode }).children),
      )
    } else if (child.type !== Notes) {
      result.push(child as ReactElement)
    }
  })
  return result
}

export interface DeckProps {
  aspectRatio?: string
  transition?: 'none' | 'fade' | 'slide'
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function Deck({
  aspectRatio = '16/9',
  transition = 'none',
  className,
  style,
  children,
}: DeckProps) {
  const slides = flattenChildren(children)

  if (
    process.env.NODE_ENV !== 'production' &&
    slides.length === 1 &&
    typeof slides[0].type === 'function'
  ) {
    console.warn(
      '[prez] Deck received a single component child. Slides should be direct children of Deck, not wrapped in a component. Use {Slides()} or export a Fragment instead of <Slides />.',
    )
  }

  const totalSlides = slides.length
  const { current, goTo, next, prev, containerRef } = useNavigation(totalSlides)
  const { isPresenter, broadcast, registerNotes } = usePresenter(current, goTo)

  // Detect print mode via ?print=true URL param
  const [isPrint] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('print') === 'true'
  })

  // Broadcast slide changes
  const prevSlide = useRef(current)
  useEffect(() => {
    if (prevSlide.current !== current) {
      broadcast(current)
      prevSlide.current = current
    }
  }, [current, broadcast])

  // Extract notes from slides
  const slideNotes = useMemo(() => {
    return slides.map((slide) => {
      let note = ''
      Children.forEach(
        (slide as ReactElement<{ children?: ReactNode }>).props.children,
        (child) => {
          if (React.isValidElement(child) && child.type === Notes) {
            const notesChildren = (
              child as ReactElement<{ children?: ReactNode }>
            ).props.children
            note = typeof notesChildren === 'string' ? notesChildren : ''
          }
        },
      )
      return note
    })
  }, [slides])

  useEffect(() => {
    registerNotes(slideNotes)
  }, [slideNotes, registerNotes])

  const [arW, arH] = aspectRatio.split('/').map(Number)
  const slideWidth = 1280
  const slideHeight = slideWidth * (arH / arW)

  // Scaling (hooks must be called unconditionally)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    if (isPrint || isPresenter) return
    const el = viewportRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setScale(Math.min(width / slideWidth, height / slideHeight))
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [slideHeight, isPrint, isPresenter])

  const ctx = useMemo(
    () => ({ currentSlide: current, totalSlides, next, prev, goTo }),
    [current, totalSlides, next, prev, goTo],
  )

  if (isPresenter) {
    return (
      <DeckContext.Provider value={ctx}>
        <Presenter
          slides={slides}
          notes={slideNotes}
          current={current}
          totalSlides={totalSlides}
          next={next}
          prev={prev}
        />
      </DeckContext.Provider>
    )
  }

  // Print mode: all slides stacked vertically, no transitions, page-break between
  if (isPrint) {
    return (
      <DeckContext.Provider value={ctx}>
        <style>{`
          @page { size: ${slideWidth}px ${slideHeight}px; margin: 0; }
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        `}</style>
        <div data-prez-total={totalSlides}>
          {slides.map((slide, i) => (
            <div
              key={i}
              style={{
                width: slideWidth,
                height: slideHeight,
                position: 'relative',
                overflow: 'hidden',
                pageBreakAfter: 'always',
                breakAfter: 'page',
              }}
            >
              <div style={{ position: 'absolute', inset: 0 }}>{slide}</div>
            </div>
          ))}
        </div>
      </DeckContext.Provider>
    )
  }

  const transitionStyle = (index: number): CSSProperties => {
    if (transition === 'fade') {
      return {
        opacity: index === current ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
        position: 'absolute',
        inset: 0,
      }
    }
    if (transition === 'slide') {
      const offset = (index - current) * 100
      return {
        transform: `translateX(${offset}%)`,
        transition: 'transform 0.3s ease-in-out',
        position: 'absolute',
        inset: 0,
      }
    }
    return {
      display: index === current ? 'block' : 'none',
      position: 'absolute',
      inset: 0,
    }
  }

  return (
    <DeckContext.Provider value={ctx}>
      <div
        ref={containerRef}
        className={className}
        data-prez-total={totalSlides}
        style={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <div
          ref={viewportRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: slideWidth,
              height: slideHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              position: 'relative',
            }}
          >
            {slides.map((slide, i) => (
              <div key={i} style={transitionStyle(i)}>
                {slide}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DeckContext.Provider>
  )
}
