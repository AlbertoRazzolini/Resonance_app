import type { NotificationResponse } from '@/types/notifications'

/** Notifica salvata di prova (un mi piace non letto); `overrides` cambia i campi che interessano al test. */
export function makeNotification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 'n0000000-0000-0000-0000-000000000001',
    type: 'NEW_LIKE',
    actor: { id: 'u-giulia', displayName: 'Giulia Rossi', avatarUrl: null },
    targetId: 'post-1',
    createdAt: '2026-10-23T10:00:00Z',
    read: false,
    ...overrides,
  }
}

/** `count` notifiche di prova con id `n1`, `n2`, ..., dalla più recente: la numero `n` ha l'autore «Persona n». */
export function makeNotifications(count: number, overrides: Partial<NotificationResponse> = {}): NotificationResponse[] {
  return Array.from({ length: count }, (_, i) =>
    makeNotification({
      id: `n${i + 1}`,
      actor: { id: `u${i + 1}`, displayName: `Persona ${i + 1}`, avatarUrl: null },
      targetId: `post-${i + 1}`,
      createdAt: new Date(Date.UTC(2026, 9, 23, 10, 0, 0) - i * 60_000).toISOString(),
      ...overrides,
    }),
  )
}
