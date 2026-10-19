/** Tag della cache di RTK Query: ogni area li usa per invalidare i propri elenchi (piano frontend, interfacce condivise). */
export const TAG_TYPES = [
  'Me',
  'PublicUser',
  'Concert',
  'IndieEvent',
  'FeedPost',
  'CollabPost',
  'Friendship',
  'FriendRequests',
  'UserSearch',
  'Chat',
  'Messages',
  'AdminUser',
  'HiddenContent',
] as const
