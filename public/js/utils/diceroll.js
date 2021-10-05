export default diceRoll = (dices) => {
  
  if(dices === 2) {
    const firstDice = Math.ceil(Math.random() * 6)
    const secondDice = Math.ceil(Math.random() * 6)
    const diceObj = {
      firstDice,
      secondDice,
      sum: firstDice + secondDice
    }
    return diceObj;
  }

   if(dices === 3) {
    const firstDice = Math.ceil(Math.random() * 6)
    const secondDice = Math.ceil(Math.random() * 6)
    const thirdDice = Math.ceil(Math.random() * 6)
    const diceObj = {
      firstDice,
      secondDice,
      thirdDice,
      sum: firstDice + secondDice + thirdDice
    }
    return diceObj;
  }

}