
const playerMetaInfoConverter = {
  toFirestore: (player) => {
    return {
      id: player.id,
      name : player.name ,
      wind : player.wind,
      chips : player.chips,
      playerNumber : player.playerNumber,
      currentScore : player.currentScore,
    }
  }, 
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options)
    return {id: data.id, name: data.name, wind: data.wind, chips: data.chips, playerNumber: data.playerNumber, currentScore: data.currentScore}
  }
}

const playerHandConverter = {
  toFirestore: (player)=> {
    return {
      playerHand: player.playerHand
    }
  },
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options)
    console.log(data)
    return data.playerHand
  }
}

const playerDiscardedConverter = {
  toFirestore: (player)=> {
    return {
      playerDiscarded: player.playerDiscarded
    }
  },
  fromFirestore: (snapshot,options) => {
    const data = snapshot.data(options)
    return data.playerDiscarded
  }
}

const playerCheckedConverter = {
  toFirestore: (player)=> {
    return {
      playerChecked: player.playerChecked
    }
  },
  fromFirestore: (snapshot,options) => {
    const data = snapshot.data(options)
    return data.playerChecked
  }
}

export { playerMetaInfoConverter, playerCheckedConverter, playerHandConverter, playerDiscardedConverter }