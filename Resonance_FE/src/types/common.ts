// Tipi comuni dell'API, dal codice dei DTO del backend (progettazione, sezioni 6.1 e 6.6).

/**
 * Corpo di tutte le risposte d'errore. Il frontend decide su `code`, mai su `message` (sezione 6.1);
 * `fields` e `details` sono oggetti, vuoti quando non servono.
 */
export type ErrorResponse = {
  status: number
  code: string
  error: string
  message: string
  fields: Record<string, string>
  details: Record<string, unknown>
  timestamp: string
}

/** Risposta delle liste a pagine (offset); mai il `Page` di Spring. */
export type PageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** Autore di un contenuto in forma ridotta: serve a mostrarlo e a rimandare al suo profilo pubblico. */
export type AuthorSummary = {
  id: string
  displayName: string
  avatarUrl: string | null
}
