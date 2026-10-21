import { parseHttpUrl } from '@/lib/urls'
import type { CreateFeedPostRequest } from '@/types/feed'

/** Lunghezza massima del testo di un post (progettazione, sezione 6.8). */
export const POST_BODY_MAX = 2000

/** Lunghezza massima dell'indirizzo dell'immagine (`@HttpUrl` del backend, sezione 8.6). */
export const IMAGE_URL_MAX = 2048

/** Cosa scrive l'utente nel modulo. */
export type PostValues = { body: string; imageUrl: string }

/** Errori per campo del modulo. */
export type PostErrors = Partial<Record<keyof PostValues, string>>

/**
 * Controlli del client, gli stessi del backend (testo 1–2000 senza spazi ai bordi, immagine facoltativa `http`/`https`
 * fino a 2048): un modulo sbagliato non parte. Il backend li ripete comunque (progettazione, sezione 8.6).
 */
export function validatePost({ body, imageUrl }: PostValues): PostErrors {
  const errors: PostErrors = {}
  const text = body.trim()
  if (text.length < 1 || text.length > POST_BODY_MAX) errors.body = `Scrivi qualcosa (massimo ${POST_BODY_MAX} caratteri).`
  const image = imageUrl.trim()
  if (image && (image.length > IMAGE_URL_MAX || !parseHttpUrl(image))) {
    errors.imageUrl = 'Inserisci un indirizzo che inizi con http:// o https://.'
  }
  return errors
}

/** Corpo di `POST /api/feed-posts`: i campi facoltativi vuoti non si inviano; le coordinate vanno insieme. */
export function buildPostRequest(
  { body, imageUrl }: PostValues,
  position: { latitude: number; longitude: number } | null,
): CreateFeedPostRequest {
  const image = imageUrl.trim()
  return {
    body: body.trim(),
    ...(image && { imageUrl: image }),
    ...(position && { latitude: position.latitude, longitude: position.longitude }),
  }
}
