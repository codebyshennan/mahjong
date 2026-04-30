
// helper functions
const sortHand = (playerHand, by = 'name') => {
  let sortedPlayerHand = [...playerHand];
  if(by=='name'){
    sortedPlayerHand.sort((firstCard,nextCard)=> {
      return firstCard.name.localeCompare(nextCard.name);
    })
  } else if(by=='index'){
    sortedPlayerHand.sort((firstCard,nextCard)=> {
      return firstCard.index - nextCard.index;
    })
  }
  return sortedPlayerHand;
}

export default sortHand