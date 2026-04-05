import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('api request function', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('adds Authorization header when token exists', async () => {
    localStorage.setItem('access_token', 'my-token')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    // Re-import to get fresh module with our mock
    const { api } = await import('@/lib/api')
    await api.health()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers).toHaveProperty('Authorization', 'Bearer my-token')

    vi.unstubAllGlobals()
  })

  it('does not add Authorization header when no token', async () => {
    localStorage.removeItem('access_token')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    // Need dynamic import with cache bust to get fresh module
    vi.resetModules()
    const { api } = await import('@/lib/api')
    await api.health()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers).not.toHaveProperty('Authorization')

    vi.unstubAllGlobals()
  })

  it('throws on non-OK response', async () => {
    localStorage.setItem('access_token', 'my-token')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Unauthorized' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    vi.resetModules()
    const { api } = await import('@/lib/api')
    await expect(api.health()).rejects.toThrow('Unauthorized')

    vi.unstubAllGlobals()
  })

  it('throws generic error when response body has no message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    vi.resetModules()
    const { api } = await import('@/lib/api')
    await expect(api.health()).rejects.toThrow('API error 500')

    vi.unstubAllGlobals()
  })
})
