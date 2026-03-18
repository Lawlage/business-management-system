import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SlaItemsPage } from '../SlaItemsPage'
import { createWrapper } from '../../../test/helpers'

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

const mockSlaItems = [
  { id: 1, name: 'Standard SLA', sku: 'SLA-001', tier: 'Gold', cost_price: '100.00', sale_price: '150.00' },
  { id: 2, name: 'Premium SLA', sku: 'SLA-002', tier: 'Platinum', cost_price: '200.00', sale_price: '300.00' },
]

function setup(role = 'tenant_admin') {
  const authedFetch = vi.fn().mockResolvedValue({
    data: mockSlaItems,
    current_page: 1,
    last_page: 1,
  })

  vi.mocked(useApi).mockReturnValue({ authedFetch, getHeaders: vi.fn() } as unknown as ReturnType<typeof useApi>)
  vi.mocked(useTenant).mockReturnValue({
    selectedTenantId: 'tenant-1',
    tenantTimezone: 'UTC',
    role,
  } as ReturnType<typeof useTenant>)
  vi.mocked(useNotice).mockReturnValue({ showNotice: vi.fn() } as unknown as ReturnType<typeof useNotice>)
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false) as ReturnType<typeof useConfirm>)

  const Wrapper = createWrapper(['/app/sla-items'])
  return { render: render(<Wrapper><SlaItemsPage /></Wrapper>), authedFetch }
}

describe('SlaItemsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders SLA items after loading', async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByText('Standard SLA')).toBeInTheDocument()
      expect(screen.getByText('Premium SLA')).toBeInTheDocument()
    })
  })

  it('shows SKU and pricing columns', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Standard SLA')).toBeInTheDocument())

    expect(screen.getByText('SLA-001')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
  })

  it('shows Create SLA Item button for non-standard users', async () => {
    setup('tenant_admin')
    await waitFor(() => expect(screen.getByText('Standard SLA')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /create sla item/i })).toBeInTheDocument()
  })

  it('hides Create SLA Item button for standard_user', async () => {
    setup('standard_user')
    await waitFor(() => expect(screen.getByText('Standard SLA')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /create sla item/i })).not.toBeInTheDocument()
  })

  it('shows empty state when no items', async () => {
    vi.mocked(useApi).mockReturnValue({
      authedFetch: vi.fn().mockResolvedValue({ data: [], current_page: 1, last_page: 1 }),
      getHeaders: vi.fn(),
    } as unknown as ReturnType<typeof useApi>)
    vi.mocked(useTenant).mockReturnValue({
      selectedTenantId: 'tenant-1',
      tenantTimezone: 'UTC',
      role: 'tenant_admin',
    } as ReturnType<typeof useTenant>)
    vi.mocked(useNotice).mockReturnValue({ showNotice: vi.fn() } as unknown as ReturnType<typeof useNotice>)
    vi.mocked(useConfirm).mockReturnValue(vi.fn() as ReturnType<typeof useConfirm>)

    const Wrapper = createWrapper(['/app/sla-items'])
    render(<Wrapper><SlaItemsPage /></Wrapper>)

    await waitFor(() => {
      expect(screen.getByText(/no sla items found/i)).toBeInTheDocument()
    })
  })

  it('renders search input', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('Standard SLA')).toBeInTheDocument())
    expect(screen.getByPlaceholderText(/search sla items/i)).toBeInTheDocument()
  })

  it('opens create modal when Create button clicked', async () => {
    setup('tenant_admin')
    await waitFor(() => expect(screen.getByText('Standard SLA')).toBeInTheDocument())

    const createBtn = screen.getByRole('button', { name: /\+ create sla item/i })
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(screen.getByText('Create SLA Item')).toBeInTheDocument()
    })
  })
})
