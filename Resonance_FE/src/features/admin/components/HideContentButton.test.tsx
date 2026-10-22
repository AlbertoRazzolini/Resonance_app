import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import { makeStore } from '@/app/store'
import { sessionStarted } from '@/features/auth/authSlice'
import { makeLoginResponse, makeMe } from '@/test/fixtures/users'
import { contentHidden, contentHideRejected } from '@/test/handlers/admin'
import { server } from '@/test/server'
import type { Role } from '@/types/users'
import { HideContentButton } from './HideContentButton'

// «Nascondi» sui contenuti (progettazione, sezione 5.7): solo ADMIN e SUPERADMIN, mai sui propri contenuti; chiede un
// motivo di almeno 3 caratteri; a esito riuscito mostra l'avviso e lo comunica a chi ha il pulsante.
function renderButton(roles: Role[] = ['FAN', 'ADMIN'], props: Partial<React.ComponentProps<typeof HideContentButton>> = {}) {
  const store = makeStore()
  store.dispatch(sessionStarted(makeLoginResponse({ user: makeMe({ roles }) })))
  const onHidden = vi.fn()
  render(
    <Provider store={store}>
      <HideContentButton
        type="feed-posts"
        id="p1"
        authorId="22222222-2222-2222-2222-222222222222"
        name="Post di Anna"
        onHidden={onHidden}
        {...props}
      />
    </Provider>,
  )
  return { user: userEvent.setup(), store, onHidden }
}

const trigger = () => screen.getByRole('button', { name: 'Nascondi Post di Anna' })

describe('HideContentButton · chi lo vede', () => {
  it.each([[['FAN']], [['FAN', 'MUSICIAN', 'HOST']]] as [Role[]][])('a chi ha i ruoli %s non mostra niente', (roles) => {
    renderButton(roles)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it.each([['ADMIN'], ['SUPERADMIN']] as [Role][])('a un %s mostra «Nascondi»', (role) => {
    renderButton(['FAN', role])
    expect(trigger()).toBeInTheDocument()
  })

  it('non lo mostra sui propri contenuti', () => {
    renderButton(['FAN', 'ADMIN'], { authorId: makeMe().id })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('HideContentButton · azione', () => {
  it('chiede il motivo, tiene «Nascondi» spento sotto i 3 caratteri e poi nasconde', async () => {
    const calls: Request[] = []
    server.use(contentHidden(calls))
    const { user, store, onHidden } = renderButton()

    await user.click(trigger())
    const dialog = screen.getByRole('dialog', { name: 'Nascondere il contenuto?' })
    expect(
      within(dialog).getByText('Non sarà più visibile agli utenti. Potrai ripristinarlo da Contenuti nascosti.'),
    ).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Nascondi' })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Motivo'), 'ab')
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Motivo'), 'c')
    await user.click(confirm)

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(new URL(calls[0].url).pathname).toBe('/api/admin/moderation/feed-posts/p1/hide')
    expect(await calls[0].json()).toEqual({ reason: 'abc' })
    await waitFor(() => expect(onHidden).toHaveBeenCalledTimes(1))
    expect(store.getState().confirmation.text).toBe('Contenuto nascosto.')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('con un rifiuto del backend mostra l’errore nella finestra e non conferma', async () => {
    server.use(contentHideRejected(403, 'INSUFFICIENT_PLATFORM_LEVEL'))
    const { user, store, onHidden } = renderButton()

    await user.click(trigger())
    await user.type(screen.getByLabelText('Motivo'), 'Contenuto offensivo')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Nascondi' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Puoi agire solo su account')
    expect(onHidden).not.toHaveBeenCalled()
    expect(store.getState().confirmation.text).toBeNull()
  })

  it('«Annulla» non chiama il backend', async () => {
    const calls: Request[] = []
    server.use(contentHidden(calls))
    const { user } = renderButton()

    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls).toHaveLength(0)
  })
})
