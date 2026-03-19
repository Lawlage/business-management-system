import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { ClientDetailPage } from '../ClientDetailPage'
import { createWrapper } from '../../../test/helpers'

// Mock contexts
vi.mock('../../../hooks/useApi', () => ({
  useApi: vi.fn(),
}))
vi.mock('../../../contexts/TenantContext', () => ({
  useTenant: vi.fn(),
}))
vi.mock('../../../contexts/NoticeContext', () => ({
  useNotice: vi.fn(),
}))
vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: vi.fn(),
}))

import { useApi } from '../../../hooks/useApi'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { useConfirm } from '../../../contexts/ConfirmContext'

const mockClient = {
  id: 1,
  name: 'Test Client',
  contact_name: 'John Doe',
  email: 'john@example.com',
  phone: '555-1234',
  website: 'https://example.com',
  notes: 'Some notes',
}

function setup(path = '/app/clients/1') {
  const authedFetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/clients/')) return Promise.resolve(mockClient)
    if (url.includes('/api/renewals')) return Promise.resolve({ data: [], current_page: 1, last_page: 1 })
    if (url.includes('/api/stock-allocations')) return Promise.resolve({ data: [], current_page: 1, last_page: 1 })
    if (url.includes('/api/sla-allocations')) return Promise.resolve({ data: [], current_page: 1, last_page: 1 })
    if (url.includes('/api/attachments')) return Promise.resolve([])
    return Promise.resolve({})
  })

  vi.mocked(useApi).mockReturnValue({ authedFetch, getHeaders: vi.fn() } as unknown as ReturnType<typeof useApi>)
  vi.mocked(useTenant).mockReturnValue({
    selectedTenantId: 'tenant-1',
    tenantTimezone: 'UTC',
    role: 'tenant_admin',
  } as ReturnType<typeof useTenant>)
  vi.mocked(useNotice).mockReturnValue({ showNotice: vi.fn() } as unknown as ReturnType<typeof useNotice>)
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false) as ReturnType<typeof useConfirm>)

  const Wrapper = createWrapper([path])

  return render(
    <Wrapper>
      <Routes>
        <Route path="/app/clients/:id" element={<ClientDetailPage />} />
      </Routes>
    </Wrapper>,
  )
}

describe('ClientDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    // Delay the fetch so we see the skeleton
    vi.mocked(useApi).mockReturnValue({
      authedFetch: vi.fn(() => new Promise(() => {})),
      getHeaders: vi.fn(),
    } as unknown as ReturnType<typeof useApi>)
    vi.mocked(useTenant).mockReturnValue({
      selectedTenantId: 'tenant-1',
      tenantTimezone: 'UTC',
      role: 'tenant_admin',
    } as ReturnType<typeof useTenant>)
    vi.mocked(useNotice).mockReturnValue({ showNotice: vi.fn() } as unknown as ReturnType<typeof useNotice>)
    vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false) as ReturnType<typeof useConfirm>)

    const Wrapper = createWrapper(['/app/clients/1'])
    render(
      <Wrapper>
        <Routes>
          <Route path="/app/clients/:id" element={<ClientDetailPage />} />
        </Routes>
      </Wrapper>,
    )

    // A skeleton or loading state should be present (no client name yet)
    expect(screen.queryByText('Test Client')).not.toBeInTheDocument()
  })

  it('renders client name after loading', async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument()
    })
  })

  it('renders Details, Renewals, Allocations, Documents tabs', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /renewals/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /allocations/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument()
  })

  it('shows read-only client info in details tab by default', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())

    // Read-only view shows text content, not form inputs
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    // Should not have editable inputs yet
    expect(screen.queryByDisplayValue('john@example.com')).not.toBeInTheDocument()
  })

  it('shows Edit button for tenant_admin in read-only mode', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })

  it('shows form inputs after clicking Edit', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))

    expect(screen.getByDisplayValue('Test Client')).toBeInTheDocument()
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('shows back navigation link', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())
    expect(screen.getByText('Clients')).toBeInTheDocument()
  })

  it('shows action menu button for tenant_admin', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument()
  })

  it('action menu contains Delete Client for tenant_admin', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /actions/i }))
    expect(screen.getByText('Delete Client')).toBeInTheDocument()
  })

  it('shows no Edit button for standard_user', async () => {
    vi.mocked(useApi).mockReturnValue({
      authedFetch: vi.fn().mockResolvedValue(mockClient),
      getHeaders: vi.fn(),
    } as unknown as ReturnType<typeof useApi>)
    vi.mocked(useTenant).mockReturnValue({
      selectedTenantId: 'tenant-1',
      tenantTimezone: 'UTC',
      role: 'standard_user',
    } as ReturnType<typeof useTenant>)
    vi.mocked(useNotice).mockReturnValue({ showNotice: vi.fn() } as unknown as ReturnType<typeof useNotice>)
    vi.mocked(useConfirm).mockReturnValue(vi.fn() as ReturnType<typeof useConfirm>)

    const Wrapper = createWrapper(['/app/clients/1'])
    render(
      <Wrapper>
        <Routes>
          <Route path="/app/clients/:id" element={<ClientDetailPage />} />
        </Routes>
      </Wrapper>,
    )

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Client' })).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  it('shows "Client not found" when fetch returns null', async () => {
    vi.mocked(useApi).mockReturnValue({
      authedFetch: vi.fn().mockRejectedValue({ message: 'Not found', status: 404 }),
      getHeaders: vi.fn(),
    } as unknown as ReturnType<typeof useApi>)
    vi.mocked(useTenant).mockReturnValue({
      selectedTenantId: 'tenant-1',
      tenantTimezone: 'UTC',
      role: 'tenant_admin',
    } as ReturnType<typeof useTenant>)
    vi.mocked(useNotice).mockReturnValue({ showNotice: vi.fn() } as unknown as ReturnType<typeof useNotice>)
    vi.mocked(useConfirm).mockReturnValue(vi.fn() as ReturnType<typeof useConfirm>)

    const Wrapper = createWrapper(['/app/clients/999'])
    render(
      <Wrapper>
        <Routes>
          <Route path="/app/clients/:id" element={<ClientDetailPage />} />
        </Routes>
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText(/client not found/i)).toBeInTheDocument()
    })
  })
})
