import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the api module before importing the store
vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      login: vi.fn(),
      signup: vi.fn(),
      me: vi.fn(),
    },
  },
}))

import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({ user: null, token: null, isLoading: true })
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('has correct initial state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isLoading).toBe(true)
  })

  describe('loadUser', () => {
    it('sets isLoading false when no token exists', async () => {
      localStorage.removeItem('access_token')
      await useAuthStore.getState().loadUser()
      const state = useAuthStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.user).toBeNull()
    })

    it('fetches user when token exists', async () => {
      localStorage.setItem('access_token', 'test-token')
      const mockUser = { id: '1', tenant_id: 't1', role: 'admin', full_name: 'Test User' }
      vi.mocked(api.auth.me).mockResolvedValue({ data: mockUser, error: null })

      await useAuthStore.getState().loadUser()
      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.token).toBe('test-token')
      expect(state.isLoading).toBe(false)
    })

    it('clears state when me() fails', async () => {
      localStorage.setItem('access_token', 'bad-token')
      vi.mocked(api.auth.me).mockRejectedValue(new Error('Unauthorized'))

      await useAuthStore.getState().loadUser()
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(localStorage.getItem('access_token')).toBeNull()
    })
  })

  describe('logout', () => {
    it('clears user, token, and localStorage', () => {
      // Mock window.location
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { href: '' },
      })

      localStorage.setItem('access_token', 'test-token')
      useAuthStore.setState({ user: { id: '1', tenant_id: 't1', role: 'admin', full_name: 'Test' }, token: 'test-token' })

      useAuthStore.getState().logout()
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(localStorage.getItem('access_token')).toBeNull()
      expect(window.location.href).toBe('/login')

      // Restore
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      })
    })
  })

  describe('login', () => {
    it('stores token and fetches user profile', async () => {
      const mockUser = { id: '1', tenant_id: 't1', role: 'admin', full_name: 'Test' }
      vi.mocked(api.auth.login).mockResolvedValue({ data: { access_token: 'new-token', user: mockUser }, error: null })
      vi.mocked(api.auth.me).mockResolvedValue({ data: mockUser, error: null })

      await useAuthStore.getState().login('test@example.com', 'password')
      const state = useAuthStore.getState()
      expect(localStorage.getItem('access_token')).toBe('new-token')
      expect(state.user).toEqual(mockUser)
      expect(state.isLoading).toBe(false)
    })
  })
})
