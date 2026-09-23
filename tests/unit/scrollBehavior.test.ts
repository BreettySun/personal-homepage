import { afterEach, describe, expect, it, vi } from 'vitest'
import { PAGE_LEAVE_MS, scrollBehavior } from '@/router'

const route = (path: string, hash = '', matched = 1) => ({ path, fullPath: path + hash, hash, matched: Array(matched).fill({}) }) as never

describe('scrollBehavior', () => {
  afterEach(() => vi.useRealTimers())

  it('goes to the top of a newly opened page, but only after the old page has faded out', async () => {
    vi.useFakeTimers()
    const p = scrollBehavior(route('/essays/河流'), route('/essays/丘陵'), null) as Promise<unknown>
    let done: unknown
    void p.then(v => { done = v })
    await vi.advanceTimersByTimeAsync(PAGE_LEAVE_MS - 20)
    expect(done).toBeUndefined()
    await vi.advanceTimersByTimeAsync(40)
    expect(done).toEqual({ top: 0 })
  })
  it('restores the saved position on back/forward and honours #hash anchors', async () => {
    vi.useFakeTimers()
    const back = scrollBehavior(route('/essays'), route('/essays/丘陵'), { left: 0, top: 640 }) as Promise<unknown>
    const anchor = scrollBehavior(route('/about', '#links'), route('/essays'), null) as Promise<unknown>
    await vi.advanceTimersByTimeAsync(PAGE_LEAVE_MS + 1)
    await expect(back).resolves.toEqual({ left: 0, top: 640 })
    await expect(anchor).resolves.toEqual({ el: '#links' })
  })
  it('does not wait on the first load', () => {
    expect(scrollBehavior(route('/essays'), route('/', '', 0), null)).toEqual({ top: 0 })
  })
})
