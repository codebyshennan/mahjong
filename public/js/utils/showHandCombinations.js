
// take in simplified hand first
// e.g. console.log(showHandCombinations(PLAYERS[0].showSimplifiedHand())
/**
 *
 *
 * @param {*} hand
 * @return {*} 
 */
const showHandCombinations = (hand) => {
  let combinations = []


  // find the key where value == 2
  const playerTallyByName = tallyByName(hand)
  console.log(playerTallyByName)

  // find pairs, remove triples
  // if only one pair, i.e. eye, remove eye from hand

  let temp = []
  let pairs = []
  let triples = []
  for (const [key, value] of Object.entries(playerTallyByName)){
    if (value == 2){
      pairs.push(key)
    }
    if (value == 3) {
      const indexOfTriple = sortedHand.findIndex(tile => tile.name == key)
      triples.push([sortedHand.splice(indexOfTriple,3)])
    }
  }
  console.log("Pairs: ", pairs)
  console.log("Triples: ", triples)
 

  if(pairs.length == 1) {
    const indexOfPair = sortedHand.findIndex(tile=> tile.name == pairs[0])
    temp.push([sortedHand.splice(indexOfPair,2)])
  }

  console.log(`Remaining Tiles: ${sortedHand.length} tiles`)

  if(sortedHand.length == 0 ){
    combinations.push(temp)
  }

    temp = []
    combinations.flat(2)

  return combinations

}

export default showHandCombinations

// console.log("Combinations", showHandCombinations(PLAYERS[0].showSimplifiedHand()))

