import { useCallback, useEffect, useRef, useState } from 'react'

const CHANNEL_NAME = 'prez-sync'

interface SyncMessage {
  type: 'slide-change' | 'request-sync'
  slide: number
  source: 'presenter' | 'deck'
}

export function usePresenter(
  current: number,
  goTo: (index: number) => void,
) {
  const isPresenter =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('presenter') === 'true'

  const channelRef = useRef<BroadcastChannel | null>(null)
  const [notes, setNotes] = useState<string[]>([])

  useEffect(() => {
    channelRef.current = new BroadcastChannel(CHANNEL_NAME)

    channelRef.current.onmessage = (e: MessageEvent<SyncMessage>) => {
      if (isPresenter && e.data.source === 'deck') return
      if (!isPresenter && e.data.source === 'presenter') {
        goTo(e.data.slide)
      }
      if (isPresenter && e.data.type === 'slide-change') {
        goTo(e.data.slide)
      }
    }

    if (isPresenter) {
      channelRef.current.postMessage({
        type: 'request-sync',
        slide: current,
        source: 'presenter',
      } satisfies SyncMessage)
    }

    return () => {
      channelRef.current?.close()
    }
  }, [isPresenter, goTo])

  const broadcast = useCallback(
    (slide: number) => {
      channelRef.current?.postMessage({
        type: 'slide-change',
        slide,
        source: isPresenter ? 'presenter' : 'deck',
      } satisfies SyncMessage)
    },
    [isPresenter],
  )

  const registerNotes = useCallback((slideNotes: string[]) => {
    setNotes(slideNotes)
  }, [])

  return { isPresenter, broadcast, notes, registerNotes }
}
