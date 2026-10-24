import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Dove sta l'effetto magnete (FE-12, decisione 107): i pulsanti d'azione principali e quelli di invio dei moduli, mai la
// barra, la colonna, il footer, le altre schede, i filtri dei chilometri, le righe degli elenchi e il pulsante di invio
// della chat; le tre schede degli eventi vicini sono un'eccezione voluta dallo studente. Il test
// legge i sorgenti: jsdom non fa il layout, quindi controlla che ogni punto dell'elenco usi `DesktopMagnet`.
const src = path.join(import.meta.dirname, '..', '..')
const read = (file: string) => readFileSync(path.join(src, file), 'utf8')

const WITH_MAGNET = [
  'features/events/pages/NearbyEventsPage.tsx', // Schede Eventi / Ufficiali / Indie (eccezione voluta dallo studente)
  'features/feed/components/NewPostPanel.tsx', // Nuovo post
  'features/collab/pages/CollabBoardPage.tsx', // Pubblica annuncio
  'features/collab/components/MyCollabTab.tsx', // Pubblica annuncio (profilo)
  'features/events/components/MyEventsTab.tsx', // Pubblica evento
  'features/users/pages/ProfilePage.tsx', // Modifica profilo
  'features/friends/pages/FriendsPage.tsx', // Cerca persone
  'features/friends/components/FriendshipPages.tsx', // Cerca persone (stato vuoto)
  'features/chat/components/ConversationList.tsx', // Cerca persone (stato vuoto)
  'features/auth/pages/RegisterPage.tsx',
  'features/auth/pages/VerifyPage.tsx',
  'features/auth/pages/ForgotPasswordPage.tsx',
  'features/auth/pages/ResetPasswordPage.tsx',
  'features/users/components/ProfileForm.tsx',
  'features/feed/components/NewPostForm.tsx',
  'features/collab/components/CollabForm.tsx',
  'features/collab/components/ApplyForm.tsx',
  'features/events/components/ConcertForm.tsx',
  'features/events/components/IndieEventForm.tsx',
  'features/events/components/ContactOrganizer.tsx',
]

const WITHOUT_MAGNET = [
  'components/layout/NavBar.tsx',
  'components/layout/SideNav.tsx',
  'components/layout/TabBar.tsx',
  'components/layout/Footer.tsx',
  'components/layout/UserMenu.tsx',
  'features/chat/components/MessageComposer.tsx',
  'features/auth/pages/LoginPage.tsx', // ha già il bordo animato
]

describe('dove sta DesktopMagnet', () => {
  it.each(WITH_MAGNET)('%s usa DesktopMagnet', (file) => {
    expect(read(file)).toContain('<DesktopMagnet')
  })

  it.each(WITHOUT_MAGNET)('%s non usa DesktopMagnet', (file) => {
    expect(read(file)).not.toContain('DesktopMagnet')
  })
})

// Le card di autenticazione sono strette: il pulsante a tutta larghezza usciva dai bordi (segnalato il 24 ottobre).
const AUTH_PAGES = [
  'features/auth/pages/RegisterPage.tsx',
  'features/auth/pages/VerifyPage.tsx',
  'features/auth/pages/ForgotPasswordPage.tsx',
  'features/auth/pages/ResetPasswordPage.tsx',
]

describe('le card di autenticazione usano AUTH_MAGNET_LOOK', () => {
  it.each(AUTH_PAGES)('%s passa look={AUTH_MAGNET_LOOK}', (file) => {
    expect(read(file)).toContain('look={AUTH_MAGNET_LOOK}')
  })
})
