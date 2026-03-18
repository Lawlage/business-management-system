import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

/**
 * Wraps a component in the providers required for rendering feature pages in tests.
 */
export function createWrapper(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}
