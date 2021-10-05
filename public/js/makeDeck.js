import { NUMBERED_TILES, CHAR_SUITS, BAMBOO_SUITS, DOTS_SUITS, SUIT_LIST, DRAGON_TILES, DRAGON_SUITS, WIND_TILES, WIND_SUITS, ANIMAL_TILES, ANIMAL_SUITS, FLOWER_TILES, FLOWER_SUITS, WIN_COMBO } from './tileset.js'

// build tiles
const buildTiles = () => {
  let tiles = [];
  
  // create 108 numbered tiles
  const insertNumberedTiles = () => {
    for(let tiletype = 0; tiletype < NUMBERED_TILES.length; tiletype ++) {
      for(let copy = 0; copy < 4; copy++) {
        for (let count = 0; count < 9; count++) {
          let tile = {
            name: `${NUMBERED_TILES[tiletype].substr(0,1)}${count+1}`,
            url : `assets/svgtiles/${NUMBERED_TILES[tiletype].substr(0,1)}${count+1}.svg`,
            suit : SUIT_LIST[tiletype][count],
            copy : copy + 1, // indicate which copy it is, so can group by name then count pong
            count : count + 1, 
            index : (count + 1) + (9 *(copy)) + (36 * (tiletype))
          }
        tiles.push(tile)
        }
      }
    }
  }

  // create 16 wind tiles
  const insertWindTiles = () => {
    for(let tiletype = 0; tiletype < WIND_TILES.length; tiletype ++) {
      for(let copy = 0; copy < 4; copy++){
        let tile = {
          name:  `${WIND_TILES[tiletype]}`,
          url : `assets/svgtiles/${WIND_TILES[tiletype]}.svg`,
          suit : WIND_SUITS[tiletype],
          copy : copy + 1,
          count : tiletype + 1, // ESWN
          index : 108 + (copy + 1) * (tiletype + 1)
        }
        tiles.push(tile)
      }
    }
  }

  // create 12 dragon tiles
  const insertDragonTiles = () => {
    for(let tiletype = 0; tiletype < DRAGON_TILES.length; tiletype ++) {
      for(let copy = 0; copy < 4; copy++) {
        let tile = {}
        tile.name = `${DRAGON_TILES[tiletype]}dragon`;
        tile.url = `assets/svgtiles/dragon_${DRAGON_TILES[tiletype]}.svg`
        tile.copy = copy + 1;
        tile.suit = DRAGON_SUITS[tiletype]
        tile.index = 124 + (copy + 1) * (tiletype + 1)
        tiles.push(tile)
      }
    }
  }
  
  // create 8 wind tiles
  const insertFlowerTiles = () => {
    for(let tiletype = 0; tiletype < FLOWER_TILES.length; tiletype ++) {
      let tile = {}
      tile.name = `${FLOWER_TILES[tiletype]}`;
      tile.url = `assets/svgtiles/${FLOWER_TILES[tiletype]}.svg`
      tile.suit = FLOWER_SUITS[tiletype]
      tile.count = (tiletype % 4) + 1;
      tile.index = 136 + (tiletype + 1)
      tiles.push(tile)
    }
  }

  // create 4 animal tiles
  const insertAnimalTiles = () => {
    for(let tiletype = 0; tiletype < ANIMAL_TILES.length; tiletype ++) {
      let tile = {}
      tile.name = `${ANIMAL_TILES[tiletype]}`;
      tile.url = `assets/svgtiles/${ANIMAL_TILES[tiletype]}.svg`
      tile.suit = ANIMAL_SUITS[tiletype];
      tile.index = 144 + (tiletype + 1)
      tiles.push(tile);
    }
  }

  insertNumberedTiles();
  insertDragonTiles();
  insertWindTiles();
  insertFlowerTiles();
  insertAnimalTiles();

  return tiles;
}

const shuffleTiles = (deck) => {
  console.log('Shuffling...')
  let shuffledDeck = [...deck];

  for(let i=0; i<shuffledDeck.length;i++){
      
      let currentTile = shuffledDeck[i]
      let randomIndex = Math.floor(Math.random() * shuffledDeck.length)
      let randomTile = shuffledDeck[randomIndex];
      
      shuffledDeck[i] = randomTile;
      shuffledDeck[randomIndex] = currentTile;
  }
 
  return shuffledDeck;
}

export const refDeck = () => {
  let refObj = {}
  buildTiles().forEach(tile=> {
    refObj[tile.name] = tile.suit
  })
  return refObj
}

export const buildDeck = () => {
  return shuffleTiles(buildTiles())
}
