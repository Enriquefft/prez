import type { CSSProperties, ReactNode } from 'react'

export interface SlideProps {
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function Slide({ className, style, children }: SlideProps) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
