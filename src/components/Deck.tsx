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
  showFullscreenButton?: boolean
  downloadUrl?: string | { pdf?: string; pptx?: string }
  className?: string
  style?: CSSProperties
  children: ReactNode
}

function FullscreenButton({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [visible, setVisible] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      setVisible(true)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange)
    }
  }, [])

  useEffect(() => {
    const resetTimer = () => {
      setVisible(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), 3000)
    }
    resetTimer()
    const el = containerRef.current
    if (!el) return
    el.addEventListener('mousemove', resetTimer)
    el.addEventListener('touchstart', resetTimer)
    return () => {
      clearTimeout(timerRef.current)
      el.removeEventListener('mousemove', resetTimer)
      el.removeEventListener('touchstart', resetTimer)
    }
  }, [containerRef])

  const toggle = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      const req =
        el.requestFullscreen ||
        (el as unknown as { webkitRequestFullscreen?: () => Promise<void> })
          .webkitRequestFullscreen
      req?.call(el)
    }
  }

  const fsEnabled =
    typeof document !== 'undefined' &&
    (document.fullscreenEnabled ||
      (document as unknown as { webkitFullscreenEnabled?: boolean })
        .webkitFullscreenEnabled)

  if (!fsEnabled) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        opacity: visible ? 0.7 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.3s',
        zIndex: 9999,
        padding: 0,
      }}
    >
      {isFullscreen ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label="Exit fullscreen"
        >
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
          aria-label="Enter fullscreen"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      )}
    </button>
  )
}

function DownloadButton({
  downloadUrl,
  containerRef,
}: {
  downloadUrl: string | { pdf?: string; pptx?: string }
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [visible, setVisible] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resetTimer = () => {
      setVisible(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), 3000)
    }
    resetTimer()
    const el = containerRef.current
    if (!el) return
    el.addEventListener('mousemove', resetTimer)
    el.addEventListener('touchstart', resetTimer)
    return () => {
      clearTimeout(timerRef.current)
      el.removeEventListener('mousemove', resetTimer)
      el.removeEventListener('touchstart', resetTimer)
    }
  }, [containerRef])

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!showMenu) return
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showMenu])

  const isSimple = typeof downloadUrl === 'string'

  const buttonStyle: CSSProperties = {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    opacity: visible ? 0.7 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 0.3s',
    zIndex: 9999,
    padding: 0,
    textDecoration: 'none',
  }

  const downloadIcon = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Download"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )

  if (isSimple) {
    return (
      <a
        href={downloadUrl}
        download
        style={buttonStyle}
        aria-label="Download presentation"
      >
        {downloadIcon}
      </a>
    )
  }

  const urls = downloadUrl as { pdf?: string; pptx?: string }

  return (
    <div
      ref={menuRef}
      style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 9999 }}
    >
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        style={buttonStyle}
        aria-label="Download presentation"
      >
        {downloadIcon}
      </button>
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: 52,
            left: 0,
            background: 'rgba(0,0,0,0.85)',
            borderRadius: 8,
            padding: '4px 0',
            minWidth: 140,
            backdropFilter: 'blur(8px)',
          }}
        >
          {urls.pdf && (
            <a
              href={urls.pdf}
              download
              style={{
                display: 'block',
                padding: '8px 16px',
                color: 'white',
                textDecoration: 'none',
                fontSize: 14,
                fontFamily: 'system-ui, sans-serif',
              }}
              onClick={() => setShowMenu(false)}
            >
              Download PDF
            </a>
          )}
          {urls.pptx && (
            <a
              href={urls.pptx}
              download
              style={{
                display: 'block',
                padding: '8px 16px',
                color: 'white',
                textDecoration: 'none',
                fontSize: 14,
                fontFamily: 'system-ui, sans-serif',
              }}
              onClick={() => setShowMenu(false)}
            >
              Download PPTX
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export function Deck({
  aspectRatio = '16/9',
  transition = 'none',
  showFullscreenButton = true,
  downloadUrl,
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
    const widthMm = ((slideWidth / 96) * 25.4).toFixed(2)
    const heightMm = ((slideHeight / 96) * 25.4).toFixed(2)
    return (
      <DeckContext.Provider value={ctx}>
        <style>{`
          @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
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
        {showFullscreenButton && (
          <FullscreenButton containerRef={containerRef} />
        )}
        {downloadUrl && (
          <DownloadButton
            downloadUrl={downloadUrl}
            containerRef={containerRef}
          />
        )}
      </div>
    </DeckContext.Provider>
  )
}
