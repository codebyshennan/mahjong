// LocalStorage-backed practice stats. Survives reshuffles and reloads.

export interface PracticeStats {
  roundsPlayed: number
  wins: number
  selfDrawWins: number
  discardWins: number
  draws: number
  currentStreak: number
  longestStreak: number
  maxTai: number
  totalTai: number
}

const KEY = 'mahjong:practice-stats'

const empty = (): PracticeStats => ({
  roundsPlayed: 0,
  wins: 0,
  selfDrawWins: 0,
  discardWins: 0,
  draws: 0,
  currentStreak: 0,
  longestStreak: 0,
  maxTai: 0,
  totalTai: 0,
})

export function loadStats(): PracticeStats {
  if (typeof window === 'undefined') return empty()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return empty()
    return { ...empty(), ...JSON.parse(raw) }
  } catch {
    return empty()
  }
}

function saveStats(s: PracticeStats): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // ignore quota errors
  }
}

export type RoundOutcome =
  | { kind: 'self-draw-win'; tai: number }
  | { kind: 'discard-win'; tai: number }
  | { kind: 'lose' }
  | { kind: 'draw' }

export function recordRound(outcome: RoundOutcome): PracticeStats {
  const s = loadStats()
  s.roundsPlayed += 1
  if (outcome.kind === 'self-draw-win' || outcome.kind === 'discard-win') {
    s.wins += 1
    if (outcome.kind === 'self-draw-win') s.selfDrawWins += 1
    else s.discardWins += 1
    s.currentStreak += 1
    if (s.currentStreak > s.longestStreak) s.longestStreak = s.currentStreak
    s.totalTai += outcome.tai
    if (outcome.tai > s.maxTai) s.maxTai = outcome.tai
  } else if (outcome.kind === 'draw') {
    s.draws += 1
    s.currentStreak = 0
  } else {
    s.currentStreak = 0
  }
  saveStats(s)
  return s
}

export function resetStats(): PracticeStats {
  const s = empty()
  saveStats(s)
  return s
}

export function avgTai(s: PracticeStats): number {
  if (s.wins === 0) return 0
  return s.totalTai / s.wins
}

export function winRate(s: PracticeStats): number {
  if (s.roundsPlayed === 0) return 0
  return s.wins / s.roundsPlayed
}
