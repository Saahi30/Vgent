import { describe, it, expect } from 'vitest'
import { cn, formatDuration, formatDate, maskPhone } from '@/lib/utils'

describe('formatDuration', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats 90 seconds as 1:30', () => {
    expect(formatDuration(90)).toBe('1:30')
  })

  it('formats 3600 seconds as 60:00', () => {
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('formats 65 seconds as 1:05', () => {
    expect(formatDuration(65)).toBe('1:05')
  })
})

describe('formatDate', () => {
  it('formats a valid date string', () => {
    const result = formatDate('2024-01-15T10:30:00Z')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })
})

describe('maskPhone', () => {
  it('returns short phone numbers unchanged', () => {
    expect(maskPhone('12345')).toBe('12345')
    expect(maskPhone('123456')).toBe('123456')
  })

  it('masks phone numbers longer than 6 characters', () => {
    expect(maskPhone('+1234567890')).toBe('+12****890')
    expect(maskPhone('1234567')).toBe('123****567')
  })
})

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })
})
