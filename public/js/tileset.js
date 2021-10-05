// Rules for Mahjong
// http://gambiter.com/mahjong/Singaporean_mahjong_scoring_rules.html
// The Tile Set
// The tile set is made up of 148 tiles. These 148 tiles are broken into suits that contain 136 total playable tiles,
// flower suit tiles that contain 8 tiles, and animal suit tiles that contain 4 tiles.

export const TILE_BACK = '🀫'
export const NUMBERED_TILES = ['bamboo','dots','character']
export const CHAR_SUITS = ['🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏']
export const BAMBOO_SUITS = ['🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘']
export const DOTS_SUITS = ['🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡']
export const SUIT_LIST = [BAMBOO_SUITS, DOTS_SUITS, CHAR_SUITS]
export const DRAGON_TILES = ['red','green','blue']
export const DRAGON_SUITS = ['🀄','🀅','🀆']
export const WIND_TILES = ['east','south','west','north']
export const WIND_SUITS= ['🀀','🀁','🀂','🀃'];
export const ANIMAL_TILES = ['cat','rat','hen','bug']
export const ANIMAL_SUITS = ['🐈','🐀','🐓','🐛']
export const FLOWER_TILES = ['plum','orchid','chrysanthemum','bamboo','spring','summer','autumn','winter']
export const FLOWER_SUITS = ['🀢','🀣','🀥','🀤','🀦','🀧','🀨','🀩']
export const WIN_COMBO = [
  FLOWER_TILES,
  ['4 x triples + 1 x eye'], // sort ->
  ['4 x sequence + 1 x eye'], 
]
