import { setupServer } from 'msw/node'

// Server MSW condiviso dai test: ogni card aggiunge i suoi handler (cartella test/handlers).
export const server = setupServer()
