import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '@/hooks/useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  url: string
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('connects when enabled and token provided', () => {
    renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: 'test-token', enabled: true })
    )
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toContain('/ws/calls?token=test-token')
  })

  it('does not connect when disabled', () => {
    renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: 'test-token', enabled: false })
    )
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('does not connect when token is null', () => {
    renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: null, enabled: true })
    )
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('sets connected to true on open', () => {
    const { result } = renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: 'test-token' })
    )

    act(() => {
      MockWebSocket.instances[0].onopen?.()
    })

    expect(result.current.connected).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('parses JSON messages and calls onMessage', () => {
    const onMessage = vi.fn()
    renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: 'test-token', onMessage })
    )

    act(() => {
      MockWebSocket.instances[0].onopen?.()
      MockWebSocket.instances[0].onmessage?.({ data: '{"type":"update","id":1}' })
    })

    expect(onMessage).toHaveBeenCalledWith({ type: 'update', id: 1 })
  })

  it('passes raw data when JSON parsing fails', () => {
    const onMessage = vi.fn()
    renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: 'test-token', onMessage })
    )

    act(() => {
      MockWebSocket.instances[0].onopen?.()
      MockWebSocket.instances[0].onmessage?.({ data: 'plain text' })
    })

    expect(onMessage).toHaveBeenCalledWith('plain text')
  })

  it('attempts reconnect on close', () => {
    renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: 'test-token' })
    )

    expect(MockWebSocket.instances).toHaveLength(1)

    act(() => {
      MockWebSocket.instances[0].onclose?.()
    })

    // Advance past the first reconnect delay (1000ms * 2^0 = 1000ms)
    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('sets error on WebSocket error', () => {
    const { result } = renderHook(() =>
      useWebSocket({ path: '/ws/calls', token: 'test-token' })
    )

    act(() => {
      MockWebSocket.instances[0].onerror?.()
    })

    expect(result.current.error).toBe('WebSocket connection failed')
  })
})
