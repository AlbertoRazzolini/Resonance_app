import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageLoadWarning } from './ImageLoadWarning'

// Prova di caricamento dell'immagine nel modulo del post: dopo una breve attesa prova a caricare l'indirizzo (senza
// Referer) e, se il browser non riesce, avvisa senza bloccare; con un indirizzo non valido non contatta nessuno.
const WARNING = "Serve il link diretto all'immagine: tienila premuta (o clic destro) e scegli «Copia indirizzo immagine»."

/** `Image` finta: carica o fallisce secondo `loads`, e ricorda come è stata usata. */
class FakeImage {
  static created: FakeImage[] = []
  static loads: (url: string) => boolean = () => true
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  referrerPolicy = ''
  url = ''

  set src(value: string) {
    this.url = value
    FakeImage.created.push(this)
    queueMicrotask(() => (FakeImage.loads(value) ? this.onload?.() : this.onerror?.()))
  }
}

function stubImage(loads: (url: string) => boolean) {
  FakeImage.created = []
  FakeImage.loads = loads
  vi.stubGlobal('Image', FakeImage)
}

afterEach(() => vi.unstubAllGlobals())

describe('ImageLoadWarning', () => {
  it('se l\'immagine non si carica avvisa, dopo una breve attesa', async () => {
    stubImage(() => false)
    render(<ImageLoadWarning url="https://www.bing.com/images/search?q=x" />)

    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()
    expect(await screen.findByText(WARNING)).toBeInTheDocument()
  })

  it('se l\'immagine si carica non dice niente', async () => {
    stubImage(() => true)
    render(<ImageLoadWarning url="https://example.com/a.png" />)

    await waitFor(() => expect(FakeImage.created).toHaveLength(1))
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()
  })

  it('prova a caricare senza Referer', async () => {
    stubImage(() => true)
    render(<ImageLoadWarning url="https://example.com/a.png" />)

    await waitFor(() => expect(FakeImage.created).toHaveLength(1))
    expect(FakeImage.created[0].url).toBe('https://example.com/a.png')
    expect(FakeImage.created[0].referrerPolicy).toBe('no-referrer')
  })

  it.each(['', '   ', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'non un indirizzo'])(
    'con «%s» non contatta nessuno e non avvisa (gli errori di formato li dice il modulo)',
    async (url) => {
      stubImage(() => false)
      render(<ImageLoadWarning url={url} />)

      await new Promise((resolve) => setTimeout(resolve, 800))
      expect(FakeImage.created).toHaveLength(0)
      expect(screen.queryByText(WARNING)).not.toBeInTheDocument()
    },
  )

  it('cambiando indirizzo l\'avviso sparisce e si riprova con quello nuovo', async () => {
    stubImage((url) => url.endsWith('.png'))
    const { rerender } = render(<ImageLoadWarning url="https://example.com/pagina" />)
    expect(await screen.findByText(WARNING)).toBeInTheDocument()

    rerender(<ImageLoadWarning url="https://example.com/a.png" />)

    await waitFor(() => expect(screen.queryByText(WARNING)).not.toBeInTheDocument())
    await waitFor(() => expect(FakeImage.created.map((image) => image.url)).toEqual([
      'https://example.com/pagina',
      'https://example.com/a.png',
    ]))
  })

  it('scrivendo di continuo prova solo l\'ultimo indirizzo', async () => {
    stubImage(() => true)
    const { rerender } = render(<ImageLoadWarning url="https://e" />)
    rerender(<ImageLoadWarning url="https://ex" />)
    rerender(<ImageLoadWarning url="https://example.com/a.png" />)

    await waitFor(() => expect(FakeImage.created).toHaveLength(1))
    expect(FakeImage.created[0].url).toBe('https://example.com/a.png')
  })
})
