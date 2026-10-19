import { describe, expect, it } from 'vitest'
import { noticeDismissed, noticeReducer, noticeShown, selectNotice } from './noticeSlice'

// Stato degli avvisi di sistema: uno alla volta, il nuovo sostituisce il vecchio.
describe('noticeSlice', () => {
  const empty = noticeReducer(undefined, { type: 'init' })

  it('parte senza avvisi', () => {
    expect(selectNotice({ notice: empty })).toBeNull()
  })

  it("noticeShown mostra l'avviso e uno nuovo sostituisce quello in corso", () => {
    const first = noticeReducer(empty, noticeShown('serverUnreachable'))
    expect(selectNotice({ notice: first })).toBe('serverUnreachable')
    const second = noticeReducer(first, noticeShown('logoutIncomplete'))
    expect(selectNotice({ notice: second })).toBe('logoutIncomplete')
  })

  it("noticeDismissed toglie l'avviso", () => {
    const shown = noticeReducer(empty, noticeShown('logoutIncomplete'))
    expect(selectNotice({ notice: noticeReducer(shown, noticeDismissed()) })).toBeNull()
  })
})
