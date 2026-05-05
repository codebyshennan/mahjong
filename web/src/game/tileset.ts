// Singapore mahjong tileset — 148 tiles.
// 108 numbered (bamboo/dots/character × 9 × 4 copies)
// 16 wind (east/south/west/north × 4 copies)
// 12 dragon (red/green/blue × 4 copies)
// 8 flower (plum/orchid/chrysanthemum/bamboo + spring/summer/autumn/winter)
// 4 animal (cat/rat/hen/bug)

export const TILE_BACK = '🀫'
export const NUMBERED_TILES = ['bamboo', 'dots', 'character'] as const
export const CHAR_SUITS = ['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'] as const
export const BAMBOO_SUITS = ['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'] as const
export const DOTS_SUITS = ['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡'] as const
export const SUIT_LIST = [BAMBOO_SUITS, DOTS_SUITS, CHAR_SUITS] as const
export const DRAGON_TILES = ['red', 'green', 'blue'] as const
export const DRAGON_SUITS = ['🀄', '🀅', '🀆'] as const
export const WIND_TILES = ['east', 'south', 'west', 'north'] as const
export const WIND_SUITS = ['🀀', '🀁', '🀂', '🀃'] as const
export const ANIMAL_TILES = ['cat', 'rat', 'hen', 'bug'] as const
export const ANIMAL_SUITS = ['🐈', '🐀', '🐓', '🐛'] as const
export const FLOWER_TILES = [
  'plum', 'orchid', 'chrysanthemum', 'bamboo',
  'spring', 'summer', 'autumn', 'winter',
] as const
export const FLOWER_SUITS = ['🀢', '🀣', '🀥', '🀤', '🀦', '🀧', '🀨', '🀩'] as const

export type Wind = (typeof WIND_TILES)[number]
export type DragonName = `${(typeof DRAGON_TILES)[number]}dragon`

/** A tile in the deck, hand, or discard. Shape matches the existing Firestore docs. */
export interface Tile {
  name: string
  url: string
  suit: string
  /** 1-9 for numbered, 1-4 for wind/flower seasons; absent for dragons/animals. */
  count?: number
  /** Which of the 4 copies (1-4); absent for flowers + animals (single copy). */
  copy?: number
  /** Stable global index (0..147ish) — used for keying & ordering. */
  index: number
}

/** A revealed meld in `playerChecked`. */
export type MeldKind =
  | 'pong'
  | 'chow'
  | 'kong-exposed'
  | 'kong-concealed'
  | 'kong-promoted'
  | 'flower'
  | 'animal'

export interface Meld {
  kind: MeldKind
  tiles: Tile[]
}

const isStringArray = (xs: readonly string[]): readonly string[] => xs

/** True for flower or animal "specials" — never enter the hand-counting path. */
export const isSpecialName = (name: string) =>
  isStringArray(FLOWER_TILES).includes(name) || isStringArray(ANIMAL_TILES).includes(name)

/** True for numbered tiles like b1, d5, c9. */
export const isNumberedName = (name: string) => /^[bdc]\d$/.test(name)

export const isDragonName = (name: string): name is DragonName =>
  isStringArray(DRAGON_TILES).some((d) => `${d}dragon` === name)

export const isWindName = (name: string): name is Wind =>
  isStringArray(WIND_TILES).includes(name)
