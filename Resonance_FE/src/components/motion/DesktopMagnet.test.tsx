import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { setFinePointer } from '@/test/viewport'
import DesktopMagnet from './DesktopMagnet'

// Magnet solo dove c'è un mouse vero (FE-12, decisione 107): con il solo touch il pulsante resta com'è, senza involucro.
beforeEach(() => setFinePointer(true))

describe('DesktopMagnet', () => {
  it('con il mouse avvolge il pulsante nell\'effetto magnete', () => {
    render(
      <DesktopMagnet>
        <button type="button">Nuovo post</button>
      </DesktopMagnet>,
    )

    expect(screen.getByRole('button', { name: 'Nuovo post' }).closest('.rs-magnet')).not.toBeNull()
  })

  it('con il solo touch (tablet e telefono) mostra il pulsante senza involucro', () => {
    setFinePointer(false)
    render(
      <DesktopMagnet>
        <button type="button">Nuovo post</button>
      </DesktopMagnet>,
    )

    expect(screen.getByRole('button', { name: 'Nuovo post' }).closest('.rs-magnet')).toBeNull()
  })

  it('con fullWidth l\'involucro occupa tutta la larghezza, per i pulsanti dei moduli', () => {
    render(
      <DesktopMagnet fullWidth>
        <button type="button">Registrati</button>
      </DesktopMagnet>,
    )

    const wrapper = screen.getByRole('button', { name: 'Registrati' }).closest('.rs-magnet') as HTMLElement
    expect(wrapper.style.display).toBe('block')
  })

  it('il pulsante resta cliccabile e raggiungibile con la tastiera', () => {
    render(
      <DesktopMagnet>
        <button type="button">Nuovo post</button>
      </DesktopMagnet>,
    )

    expect(screen.getByRole('button', { name: 'Nuovo post' })).toBeEnabled()
  })
})
