// Tipi dell'area di moderazione, dal codice dei DTO del backend (progettazione, sezioni 5.5, 5.7 e 6.10).
import type { AuthorSummary } from './common'
import type { Role, UserStatus } from './users'

/** Utente visto da un amministratore (`GET /api/admin/users`); le date sono stringhe ISO-8601 in UTC. */
export type AdminUserResponse = {
  id: string
  email: string
  displayName: string
  roles: Role[]
  status: UserStatus
  emailVerified: boolean
  createdAt: string
  suspendedAt: string | null
  suspendedBy: string | null
  suspensionReason: string | null
  /** Nullo con la sospensione indeterminata. */
  suspendedUntil: string | null
}

/** Parametri dell'elenco utenti: `search` su email e nome, `status` sullo stato salvato, `page` da 0. */
export type AdminUsersParams = {
  search?: string
  status?: UserStatus
  page: number
}

/** Corpo di `POST /api/admin/users/{id}/suspension`: al massimo uno fra `suspendedUntil` e `durationDays`. */
export type SuspendUserRequest = {
  reason: string
  /** Istante futuro, ISO-8601 in UTC. */
  suspendedUntil?: string
  /** Da 1 a 3650. */
  durationDays?: number
}

/** Un tipo di contenuto moderabile, con il segmento che il backend vuole nell'URL (sezione 5.7). */
export type ModeratedType = 'official-concerts' | 'indie-events' | 'feed-posts' | 'collab-posts'

/** Voce dell'elenco dei contenuti nascosti (`GET /api/admin/moderation/{type}/hidden`). */
export type HiddenContentResponse = {
  id: string
  author: AuthorSummary
  /** Titolo, oppure l'estratto del testo (100 caratteri) per i post del feed. */
  title: string
  hiddenAt: string
  hiddenBy: string
  hiddenReason: string | null
  /** Cancellato dal proprietario: il ripristino non è ammesso (`RESTORE_NOT_ALLOWED`). */
  deletedByOwner: boolean
}

/** Argomenti di «Nascondi» e «Ripristina»: il tipo, l'id e, per «Nascondi», il motivo. */
export type HideContentArgs = { type: ModeratedType; id: string; reason: string }
export type RestoreContentArgs = { type: ModeratedType; id: string }

/** Argomenti dell'elenco dei nascosti: il tipo e la pagina (da 0). */
export type HiddenContentParams = { type: ModeratedType; page: number }
