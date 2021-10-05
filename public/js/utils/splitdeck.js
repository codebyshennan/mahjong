export default splitDeck = (shuffledDeck) => {
  let splitDeckArray = [];
  let splitCountArray = [19,18]
  for(let i=0; i<4; i++){
    let splitStart = 2 * splitCountArray[i%2]
    splitDeckArray.push(shuffledDeck.slice(i == 0 ? i * splitStart : splitStart + 1, 
      i == 0 ? splitStart: 2 * splitStart + 1))
  }
  return splitDeckArray;
}