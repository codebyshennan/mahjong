const updateCurrentPlayerInfo = (id,name,wind,chips,playerNo) => {
  currentPlayer.id = id
  currentPlayer.name = name
  currentPlayer.wind = wind
  currentPlayer.chips = chips
  currentPlayer.playerNo = playerNo
}

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
    updateCurrentPlayerInfo(data.id, data.name, data.wind, data.chips, data.playerNumber)
  }
}

const playerHandConverter = {
  toFirestore: (player)=> {
    return {
      playerHand: player.playerHand
    }
  },
  fromFirestore: (snapshot,options) => {
    const data = snapshot.data(options)
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