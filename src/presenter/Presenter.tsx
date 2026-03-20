import React, { ReactElement, useEffect, useState } from 'react'

interface PresenterProps {
  slides: ReactElement[]
  notes: string[]
  current: number
  totalSlides: number
  next: () => void
  prev: () => void
}

export function Presenter({
  slides,
  notes,
  current,
  totalSlides,
  next,
  prev,
}: PresenterProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#1a1a1a',
        color: '#fff',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr auto',
        gap: 16,
        padding: 16,
        fontFamily: 'system-ui, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Current slide */}
      <div
        style={{
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 1280,
            height: 720,
            transform: 'scale(0.45)',
            transformOrigin: 'center center',
            pointerEvents: 'none',
          }}
        >
          {slides[current]}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 12,
            opacity: 0.6,
          }}
        >
          Current ({current + 1}/{totalSlides})
        </div>
      </div>

      {/* Next slide */}
      <div
        style={{
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {current + 1 < totalSlides ? (
          <div
            style={{
              width: 1280,
              height: 720,
              transform: 'scale(0.45)',
              transformOrigin: 'center center',
              pointerEvents: 'none',
            }}
          >
            {slides[current + 1]}
          </div>
        ) : (
          <div style={{ opacity: 0.4, fontSize: 18 }}>End of deck</div>
        )}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            fontSize: 12,
            opacity: 0.6,
          }}
        >
          Next
        </div>
      </div>

      {/* Bottom bar: notes + timer */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gap: 16,
          alignItems: 'stretch',
        }}
      >
        {/* Notes */}
        <div
          style={{
            flex: 1,
            background: '#222',
            borderRadius: 8,
            padding: 16,
            fontSize: 16,
            lineHeight: 1.6,
            overflowY: 'auto',
            maxHeight: 200,
          }}
        >
          {notes[current] || (
            <span style={{ opacity: 0.3 }}>No notes for this slide</span>
          )}
        </div>

        {/* Timer + controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 36, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(elapsed)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={prev}
              style={{
                padding: '8px 16px',
                background: '#333',
                border: 'none',
                color: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Prev
            </button>
            <button
              onClick={next}
              style={{
                padding: '8px 16px',
                background: '#333',
                border: 'none',
                color: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
