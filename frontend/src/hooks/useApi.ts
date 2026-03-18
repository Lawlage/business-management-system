import { useAuth } from '../contexts/AuthContext'
import { useTenant } from '../contexts/TenantContext'

type FetchOptions = RequestInit & { tenantScoped?: boolean; isFormData?: boolean }

export type ApiError = {
  message: string
  errors?: Record<string, string[]>
  status: number
}

export function useApi() {
  const { token, logout } = useAuth()
  const { selectedTenantId, breakGlassToken, role } = useTenant()

  /**
   * Build an authenticated Headers object for manual fetch calls (e.g. file upload/download).
   * Pass `isFormData: true` to omit the Content-Type header so the browser sets the boundary.
   */
  const getHeaders = (opts: { tenantScoped?: boolean; isFormData?: boolean } = {}): Record<string, string> => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    }

    if (!opts.isFormData) {
      headers['Content-Type'] = 'application/json'
    }

    if (opts.tenantScoped && selectedTenantId) {
      headers['X-Tenant-Id'] = selectedTenantId
      if (role === 'global_superadmin' && breakGlassToken) {
        headers['X-Break-Glass-Token'] = breakGlassToken
      }
    }

    return headers
  }

  const authedFetch = async <T,>(path: string, init: FetchOptions = {}): Promise<T> => {
    if (!token) throw new Error('Not authenticated')

    const { tenantScoped, isFormData, ...fetchInit } = init
    const headers = new Headers(fetchInit.headers ?? {})
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `Bearer ${token}`)

    if (!isFormData && !headers.has('Content-Type') && fetchInit.body) {
      headers.set('Content-Type', 'application/json')
    }

    if (tenantScoped) {
      if (!selectedTenantId) throw new Error('Select a tenant first')
      headers.set('X-Tenant-Id', selectedTenantId)
      if (role === 'global_superadmin') {
        if (!breakGlassToken) throw new Error('Start break-glass access for tenant actions')
        headers.set('X-Break-Glass-Token', breakGlassToken)
      }
    }

    const response = await fetch(path, { ...fetchInit, headers })
    const text = await response.text()
    const payload = text ? (JSON.parse(text) as unknown) : null

    if (response.status === 401) {
      logout()
      throw new Error('Session expired. Please sign in again.')
    }

    if (!response.ok) {
      const err = payload as { message?: string; errors?: Record<string, string[]> } | null
      const apiError: ApiError = {
        message: err?.message ?? `Request failed with status ${response.status}`,
        errors: err?.errors,
        status: response.status,
      }
      throw apiError
    }

    return payload as T
  }

  return { authedFetch, getHeaders }
}
