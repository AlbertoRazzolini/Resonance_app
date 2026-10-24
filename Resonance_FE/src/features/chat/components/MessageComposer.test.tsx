import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MESSAGE_MAX, MessageComposer } from './MessageComposer'

// Il selettore vero (web component con IndexedDB) non gira in jsdom: si simula il modulo e si guida a mano l'evento
// `emoji-click` sull'elemento `<emoji-picker>`.
vi.mock('emoji-picker-element', () => ({}))

/** Casella con lo stato del testo, come in ConversationView. */
function Harness({ initial = '', canSend = true }: { initial?: string; canSend?: boolean }) {
  const [value, setValue] = useState(initial)
  return (
    <MessageComposer
      name="Anna"
      value={value}
      onChange={setValue}
      onSubmit={() => undefined}
      status="connected"
      canSend={canSend}
      error={null}
    />
  )
}

/** Il selettore aperto: compare quando il modulo è stato caricato. */
async function findPicker() {
  return waitFor(() => {
    const picker = document.querySelector('emoji-picker')
    expect(picker).not.toBeNull()
    return picker as HTMLElement
  })
}

/** Simula il clic su un'emoji nel selettore. */
function pick(picker: HTMLElement, unicode: string) {
  fireEvent(picker, new CustomEvent('emoji-click', { detail: { unicode } }))
}

// Pulsante e selettore: apertura, selettore che resta aperto dopo la scelta, chiusura (Esc, clic fuori, faccina, invio).
describe('MessageComposer, selettore di emoji', () => {
  it('il pulsante «Inserisci emoji» parte chiuso e non mostra il selettore', () => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Inserisci emoji' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(document.querySelector('emoji-picker')).toBeNull()
  })

  it('il clic apre il selettore con i dati italiani locali e segna il pulsante come aperto', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Inserisci emoji' }))
    const picker = await findPicker()
    expect(screen.getByRole('button', { name: 'Inserisci emoji' })).toHaveAttribute('aria-expanded', 'true')
    // Mai da CDN (decisione 76): l'indirizzo dei dati è un file della nostra origine
    expect(picker.getAttribute('data-source')).toMatch(/^\/.*data\.json/)
    expect(picker.getAttribute('locale')).toBe('it')
  })

  it('la scelta di un’emoji lascia il selettore aperto, così se ne scelgono altre una alla volta', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Inserisci emoji' }))
    const picker = await findPicker()
    pick(picker, '🎸')
    pick(picker, '🎹')
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Messaggio per Anna' })).toHaveValue('🎸🎹'))
    expect(document.querySelector('emoji-picker')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Inserisci emoji' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('l’invio del messaggio chiude il selettore', async () => {
    render(<Harness initial="Ciao" />)
    await userEvent.click(screen.getByRole('button', { name: 'Inserisci emoji' }))
    await findPicker()
    await userEvent.click(screen.getByRole('button', { name: 'Invia' }))
    await waitFor(() => expect(document.querySelector('emoji-picker')).toBeNull())
  })

  it('Esc chiude il selettore e riporta il cursore nella casella', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Inserisci emoji' }))
    await findPicker()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(document.querySelector('emoji-picker')).toBeNull())
    expect(screen.getByRole('textbox', { name: 'Messaggio per Anna' })).toHaveFocus()
  })

  it('un clic fuori dal selettore lo chiude', async () => {
    render(
      <>
        <p>fuori</p>
        <Harness />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Inserisci emoji' }))
    await findPicker()
    await userEvent.click(screen.getByText('fuori'))
    await waitFor(() => expect(document.querySelector('emoji-picker')).toBeNull())
  })

  it('un secondo clic sul pulsante chiude il selettore', async () => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Inserisci emoji' })
    await userEvent.click(button)
    await findPicker()
    await userEvent.click(button)
    await waitFor(() => expect(document.querySelector('emoji-picker')).toBeNull())
  })

  it('con la casella spenta il pulsante è spento', () => {
    render(<Harness canSend={false} />)
    expect(screen.getByRole('button', { name: 'Inserisci emoji' })).toBeDisabled()
  })
})

// Inserimento nel punto del cursore, con il limite di 2000 caratteri.
describe('MessageComposer, inserimento dell’emoji nel testo', () => {
  /** Apre il selettore, mette il cursore fra `from` e `to` nella casella e sceglie l'emoji. */
  async function insert(unicode: string, from: number, to = from) {
    const field = screen.getByRole('textbox', { name: 'Messaggio per Anna' }) as HTMLTextAreaElement
    field.focus()
    field.setSelectionRange(from, to)
    await userEvent.click(screen.getByRole('button', { name: 'Inserisci emoji' }))
    pick(await findPicker(), unicode)
    return field
  }

  it('inserisce l’emoji nel punto del cursore, non in fondo', async () => {
    render(<Harness initial="Ciao Anna" />)
    const field = await insert('🎸', 4)
    await waitFor(() => expect(field).toHaveValue('Ciao🎸 Anna'))
  })

  it('al posto del testo selezionato, se c’è una selezione', async () => {
    render(<Harness initial="Ciao Anna" />)
    const field = await insert('🎸', 5, 9)
    await waitFor(() => expect(field).toHaveValue('Ciao 🎸'))
  })

  it('il cursore finisce dopo l’emoji, anche se è fatta di più unità (bandiera)', async () => {
    render(<Harness initial="Ciao" />)
    const field = await insert('🇮🇹', 2)
    await waitFor(() => expect(field).toHaveValue('Ci🇮🇹ao'))
    expect(field.selectionStart).toBe(2 + '🇮🇹'.length)
    expect(field.selectionEnd).toBe(2 + '🇮🇹'.length)
  })

  it('non inserisce se il messaggio supera i 2000 caratteri, senza messaggi di errore', async () => {
    const full = 'a'.repeat(MESSAGE_MAX)
    render(<Harness initial={full} />)
    const field = await insert('🎸', 5)
    expect(field).toHaveValue(full)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('inserisce se entra giusto nel limite', async () => {
    const almost = 'a'.repeat(MESSAGE_MAX - '🎸'.length)
    render(<Harness initial={almost} />)
    const field = await insert('🎸', almost.length)
    await waitFor(() => expect(field).toHaveValue(almost + '🎸'))
  })
})
