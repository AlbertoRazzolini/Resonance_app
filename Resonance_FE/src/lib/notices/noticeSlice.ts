import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * Avvisi di sistema mostrati nella barra in cima all'app: `serverUnreachable` all'avvio senza rete (con Riprova),
 * `logoutIncomplete` quando l'uscita non ha raggiunto il server. Nello stato solo il tipo: i testi stanno in `NoticeBar`.
 */
export type NoticeKind = 'serverUnreachable' | 'logoutIncomplete'

type NoticeState = { current: NoticeKind | null }

const noticeSlice = createSlice({
  name: 'notice',
  initialState: { current: null } as NoticeState,
  reducers: {
    /** Mostra un avviso; uno nuovo sostituisce quello in corso. */
    noticeShown(state, action: PayloadAction<NoticeKind>) {
      state.current = action.payload
    },
    noticeDismissed(state) {
      state.current = null
    },
  },
})

export const { noticeShown, noticeDismissed } = noticeSlice.actions
export const noticeReducer = noticeSlice.reducer

export const selectNotice = (state: { notice: NoticeState }) => state.notice.current
