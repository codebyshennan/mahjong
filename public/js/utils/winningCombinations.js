
// given player tiles in hand and player checked tiles, return various combinations that can be made
// group by chow, group by pong,
// attempt to win
/**
 *
 *
 * @param {*}
 */
const combinationsOfGroupings = (playerTiles) => {

  // comprise of playerHand (hidden) and playerChecked (played)
  // playerChecked should already be grouped since it's a winning combination
  // const totalHand = [...playerHand].push([...playerChecked])
  const TOTAL_HAND = playerTiles;
  const SORTED_HAND = sortHand(TOTAL_HAND, 'index')

  // insert possible winning combinations into this array
  let groupedTiles = []
  let winningCombinations = [];
  
  let lastTileSet = groupedTiles[groupedTiles.length-1]
  let lastTile = lastTileSet[lastTileSet.length-1]

  

  const checkTripletPong = () => {
    // tiles are in 1-9
    const playerHandTallyArray = Object.values(getPlayerTally())
    if(playerHandTallyArray.count(3)==4 && playerHandTallyArray.count(2)==1) {
      // group the tiles
      // push the combination into winningcombinations
      return true;
    }
  }

  // const checkTripletChow = (playerHand) => {
  //   // sort by name
  //   const SORTED_HANDByName = sortHand(playerHand,'name');
  //   for(let i=0; i<playerHand.length - 1; i++){
  //     // check for pairs
  //     if(SORTED_HANDByName[i] == SORTED_HANDByName[i+1]) {

  //     }
  //   }
  // }
  
  // 八仙过海
  // complete set of flowers
  const checkCompleteFlower = () => {
    let countFlowers = 0;
    for(tile in sortedTilesArray) {
      if(FLOWER_TILES.find(tile.name)){
        countFlowers++
      }
    }

    if(countFlowers == 8) {
      winningCombination = 'completeFlower'
    }
  }

}

export default combinationsOfGroupings