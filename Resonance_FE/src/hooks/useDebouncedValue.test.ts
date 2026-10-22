import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

// Attesa dopo l'ultimo cambiamento: il valore nuovo arriva solo quando non cambia più per il tempo indicato.
describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('parte dal valore iniziale e aggiorna solo dopo l’attesa', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: 'a' },
    })
    expect(result.current).toBe('a')

    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(399))
    expect(result.current).toBe('a')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('ab')
  })

  it('ogni cambiamento riparte da zero: i tasti ravvicinati danno un solo valore', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: 'm' },
    })
    rerender({ value: 'ma' })
    act(() => vi.advanceTimersByTime(300))
    rerender({ value: 'mar' })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('m')
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('mar')
  })
})
