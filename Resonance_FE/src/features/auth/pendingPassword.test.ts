import { afterEach, describe, expect, it } from 'vitest'
import { forgetPassword, recallPassword, rememberPassword } from './pendingPassword'

// Password tenuta in memoria fra registrazione (o accesso) e verifica: vale solo per l'email con cui è stata scritta.
afterEach(forgetPassword)

describe('pendingPassword', () => {
  it('restituisce la password per la stessa email', () => {
    rememberPassword('mario@example.com', 'password-lunga')

    expect(recallPassword('mario@example.com')).toBe('password-lunga')
  })

  it("ignora gli spazi ai lati dell'email, come fanno i form", () => {
    rememberPassword('  mario@example.com ', 'password-lunga')

    expect(recallPassword('mario@example.com  ')).toBe('password-lunga')
  })

  it('per un\'altra email non restituisce nulla', () => {
    rememberPassword('mario@example.com', 'password-lunga')

    expect(recallPassword('luigi@example.com')).toBeUndefined()
  })

  it('senza nulla in memoria non restituisce nulla', () => {
    expect(recallPassword('mario@example.com')).toBeUndefined()
  })

  it('dopo forgetPassword non restituisce più nulla', () => {
    rememberPassword('mario@example.com', 'password-lunga')
    forgetPassword()

    expect(recallPassword('mario@example.com')).toBeUndefined()
  })

  it('una nuova password sostituisce la precedente', () => {
    rememberPassword('mario@example.com', 'vecchia-password')
    rememberPassword('luigi@example.com', 'nuova-password')

    expect(recallPassword('mario@example.com')).toBeUndefined()
    expect(recallPassword('luigi@example.com')).toBe('nuova-password')
  })
})
