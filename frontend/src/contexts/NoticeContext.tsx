import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type NoticeEntry = {
  id: number
  message: string
  type: 'success' | 'error'
}

type NoticeContextType = {
  notices: NoticeEntry[]
  showNotice: (message: string, type?: 'success' | 'error') => void
  dismissNotice: (id: number) => void
}

const NoticeContext = createContext<NoticeContextType | null>(null)

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<NoticeEntry[]>([])
  const nextId = useRef(1)

  const dismissNotice = useCallback((id: number) => {
    setNotices((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const showNotice = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      const id = nextId.current++
      setNotices((prev) => [...prev, { id, message, type }])

      // All notices auto-dismiss after 10 seconds
      window.setTimeout(() => dismissNotice(id), 10000)
    },
    [dismissNotice],
  )

  return (
    <NoticeContext.Provider value={{ notices, showNotice, dismissNotice }}>
      {children}
    </NoticeContext.Provider>
  )
}

export function useNotice(): NoticeContextType {
  const ctx = useContext(NoticeContext)
  if (!ctx) throw new Error('useNotice must be used within NoticeProvider')
  return ctx
}
