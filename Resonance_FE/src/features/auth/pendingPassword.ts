/**
 * Password appena scritta, tenuta in memoria fra registrazione (o accesso con email non verificata) e verifica, così la
 * verifica non la richiede di nuovo (FE-12, decisione 107). È una variabile del modulo: sparisce a ogni ricarico e non
 * finisce nella cronologia del browser, come invece farebbe lo stato del router (progettazione, sezione 4.13: niente
 * credenziali in `localStorage`, `sessionStorage` o cronologia). Vale solo per l'email con cui è stata scritta.
 */
let pending: { email: string; password: string } | null = null

/** Tiene la password per questa email; sostituisce quella che c'era. */
export function rememberPassword(email: string, password: string): void {
  pending = { email: email.trim(), password }
}

/** La password tenuta per questa email, o `undefined` se manca o è di un'altra email. */
export function recallPassword(email: string): string | undefined {
  return pending && pending.email === email.trim() ? pending.password : undefined
}

/** Cancella la password dalla memoria. */
export function forgetPassword(): void {
  pending = null
}
