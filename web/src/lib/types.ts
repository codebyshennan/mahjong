export type Wind = 'east' | 'south' | 'west' | 'north'

export const ROOM_STATE = { OPEN: 1, JOINED: 2, FULL: 3 } as const
export type RoomStateValue = (typeof ROOM_STATE)[keyof typeof ROOM_STATE]
export const ROOM_STATE_LABEL: Record<RoomStateValue, string> = {
  [ROOM_STATE.OPEN]: 'OPEN',
  [ROOM_STATE.JOINED]: 'JOINED',
  [ROOM_STATE.FULL]: 'FULL',
}

export interface RoomHost {
  uid: string
  displayName: string | null
  photoURL: string | null
  playerWind: Wind
  playerNo: 0
}

export interface RoomPlayer {
  uid: string
  displayName: string | null
  photoURL: string | null
}

export interface Room {
  host: RoomHost
  state: RoomStateValue
  players: RoomPlayer[]
  playerCount: number
}

export interface OnlinePresence {
  displayName: string | null
  photoURL: string | null
  state: 'online' | 'offline'
  last_changed: unknown // Firestore Timestamp; we don't introspect it
}
