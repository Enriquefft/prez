import React, {
  Children,
  CSSProperties,
  ReactElement,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { DeckContext } from '../context'
import { useNavigation } from '../hooks/use-navigation'
import { usePresenter } from '../hooks/use-presenter'
import { Notes } from './Notes'
import { Presenter } from '../presenter/Presenter'

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
  const slides = Children.toArray(children).filter(
    (child): child is ReactElement =>
      React.isValidElement(child) && (child as ReactElement).type !== Notes,
  )

  const totalSlides = slides.length
  const { current, goTo, next, prev, containerRef } = useNavigation(totalSlides)
  const { isPresenter, broadcast, registerNotes } = usePresenter(current, goTo)

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
            const notesChildren = (child as ReactElement<{ children?: ReactNode }>).props.children
            note = typeof notesChildren === 'string'
              ? notesChildren
              : ''
          }
        },
      )
      return note
    })
  }, [slides])

  useEffect(() => {
    registerNotes(slideNotes)
  }, [slideNotes, registerNotes])

  // Scaling
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const [arW, arH] = aspectRatio.split('/').map(Number)
  const slideWidth = 1280
  const slideHeight = slideWidth * (arH / arW)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setScale(Math.min(width / slideWidth, height / slideHeight))
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [slideWidth, slideHeight])

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
