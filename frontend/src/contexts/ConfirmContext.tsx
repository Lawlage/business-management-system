import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  variant?: 'warning' | 'danger'
}

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void
}

type ConfirmContextType = {
  pending: PendingConfirm | null
  confirm: (options: ConfirmOptions) => Promise<boolean>
  resolve: (value: boolean) => void
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const resolve = useCallback(
    (value: boolean) => {
      if (pending) {
        pending.resolve(value)
        setPending(null)
      }
    },
    [pending],
  )

  return (
    <ConfirmContext.Provider value={{ pending, confirm, resolve }}>
      {children}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}

export function useConfirmContext(): ConfirmContextType {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirmContext must be used within ConfirmProvider')
  return ctx
}
