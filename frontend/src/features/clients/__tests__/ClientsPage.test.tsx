import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientsPage } from '../ClientsPage'

// Mock the hooks
vi.mock('../../../hooks/useApi', () => ({
  useApi: () => ({
    authedFetch: vi.fn().mockResolvedValue({ data: [], current_page: 1, last_page: 1 }),
  }),
}))

vi.mock('../../../contexts/TenantContext', () => ({
  useTenant: () => ({
    selectedTenantId: 'test-tenant-id',
    tenantTimezone: 'UTC',
    role: 'tenant_admin',
  }),
}))

vi.mock('../../../contexts/NoticeContext', () => ({
  useNotice: () => ({ showNotice: vi.fn() }),
}))

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ClientsPage />
      </BrowserRouter>
    </QueryClientProvider>,
  )
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title and create button', async () => {
    renderPage()

    expect(screen.getByText('Clients')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('+ Create Client')).toBeInTheDocument()
    })
  })

  it('shows empty state when no clients', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/No clients found/)).toBeInTheDocument()
    })
  })

  it('renders search input', () => {
    renderPage()

    expect(screen.getByPlaceholderText('Search clients...')).toBeInTheDocument()
  })

  it('opens create modal when clicking create button', async () => {
    renderPage()
    const user = userEvent.setup()

    await waitFor(() => {
      expect(screen.getByText('+ Create Client')).toBeInTheDocument()
    })

    await user.click(screen.getByText('+ Create Client'))

    await waitFor(() => {
      expect(screen.getByText('Create Client', { selector: 'h3' })).toBeInTheDocument()
    })
  })
})
