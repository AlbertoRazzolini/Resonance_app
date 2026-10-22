import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * Conferma breve di un'azione riuscita (es. «Amicizia accettata»), mostrata in sovrimpressione in alto a destra da `ConfirmationBar`.
 * `seq` cresce a ogni conferma: una uguale alla precedente fa ripartire i 4 secondi invece di essere ignorata.
 */
type ConfirmationState = { text: string | null; seq: number }

const confirmationSlice = createSlice({
  name: 'confirmation',
  initialState: { text: null, seq: 0 } as ConfirmationState,
  reducers: {
    /** Mostra una conferma; una nuova sostituisce quella in corso. */
    confirmationShown(state, action: PayloadAction<string>) {
      state.text = action.payload
      state.seq += 1
    },
    confirmationDismissed(state) {
      state.text = null
    },
  },
})

export const { confirmationShown, confirmationDismissed } = confirmationSlice.actions
export const confirmationReducer = confirmationSlice.reducer

export const selectConfirmation = (state: { confirmation: ConfirmationState }) => state.confirmation
