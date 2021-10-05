import {refDeck, buildDeck} from './makeDeck.js'
import sortHand from './utils/sorthand.js'
import {timer, startTimer} from './utils/timer.js'
import diceRoll from './utils/diceroll.js'
import { WIND_TILES, ANIMAL_TILES, FLOWER_TILES} from './tileset.js'


const gamelog = document.getElementById('gamelog')
let PLAYERS = []
// update gameState
let gameState = {
    windCount: 0,
    currentWind: WIND_TILES[0%3],
    currentPlayer: 0,
    currentTurnNo: 0,
    currentHouse: '',
    diceRolled: 0,
    timeStarted: new Date(),
    tilesInDiscard: 0,
    tilesInHand: 0,
    tilesToPlay: 148
  }

let deckInPlay
const timerDisplay = document.getElementById('timer')

const tallyByName = (playerHand) => {
  const sortedHand = sortHand(playerHand, 'name')
    // tally hand by name
  let playerHandTally = {}

  // get statistics about hand
  for(let i=0; i< sortedHand.length; i++){
    if(playerHandTally[sortedHand[i].name]){
      playerHandTally[sortedHand[i].name] +=1
    } else {
      playerHandTally[sortedHand[i].name] =1
    }
  }

    return playerHandTally;
  }


let possibleMergeCombinations = []
// takes as argument the names of the tiles to be highlighted
const highlightTilesToBeMergedWith = (arrayOfTileNames, type) => {
  arrayOfTileNames.forEach((tilename,index) => {
    const tiles = document.querySelectorAll(`.${tilename}`)
    const idx = tiles.length > 1 ? index : 0
    tiles[idx].classList.add(`'${type}'`)
    tiles[idx].style.border = '2px solid red'
  })

}

class Player {
  constructor(name, wind, playerNumber){
    this.name = name
    this.wind = wind
    this.chips = 1000
    this.playerNumber = playerNumber
    this.playerTiles = {
      playerHand: [],
      playerChecked: [],
      playerDiscarded: [],
      currentScore: 0,
    }
  }

  drawTile = (noOfTiles = 1, type = 'normal') => {
    // deck.shift for normal draws
    // deck.pop for flowers

    for(let drawCount = 0; drawCount < noOfTiles; drawCount+=1) {
      let newTile
      if(type == 'normal') {
        newTile = deckInPlay.shift()
      } else if(type == 'special') {
        console.log('Drawing special...')
        newTile = deckInPlay.pop()
      }

      if(ANIMAL_TILES.includes(newTile.name) || FLOWER_TILES.includes(newTile.name)) {
        console.log('Special drawn...')
        this.playerTiles.playerChecked.push(newTile)
        this.drawTile(1,'special')
      } else {
        this.playerTiles.playerHand.push(newTile)
      }

      updateGameState('drawtiles')
    }
  }

  
  discardTile = (tile) => {
    // find the index of the tile in the player's hand
    console.log('Discarding tile ', tile)
    const tileIndex = this.playerTiles.playerHand.findIndex(playerTile => playerTile.index == tile.index)
    const discardedTile = this.playerTiles.playerHand.splice(tileIndex, 1)
    this.playerTiles.playerDiscarded.push(discardedTile[0])

    timer.clearAll()
    updateGameState('discardtiles')
    updateGameState('nextround')
    renderBoard()
  }

  eatTile = (tile, withThisCombi) => {
    console.log(`Adding ${tile.name} to checked`)
    this.playerTiles.playerDiscarded.pop()

    let checkedGroup = []
    checkedGroup.push(tile)

    withThisCombi.forEach(tileName => {
      const tileToBeChecked = this.playerTiles.playerHand.find(tile=> tile.name == tileName)
      const tileIndex = this.playerTiles.playerHand.findIndex(tile => tile.name == tileName)
      this.playerTiles.playerHand.splice(tileIndex,1)
      checkedGroup.push(tileToBeChecked)
    })

    this.playerTiles.playerChecked.push(sortHand(checkedGroup))


    timer.clearAll()
    updateGameState('eattiles')
    renderBoard()
  }

  skipTurn = () => {
    const currentPlayerHand = this.playerTiles.playerHand
    const randomIndex = Math.floor(currentPlayerHand.length * Math.random())
    const randomTile = currentPlayerHand[randomIndex]
    this.discardTile(randomTile)
  }

  showSimplifiedHand = () => {
    return this.playerTiles.playerHand.map( tile => {
      
      const name = tile.name
      const index = tile.index
      const simplifiedObj = { name, index}

      return simplifiedObj
    })
  }

  checkIfCanBeEaten = (discardedTile) => {
    
    const playerTally = tallyByName(this.playerTiles.playerHand)
    console.log('TALLY BY NAME: ', playerTally)
    // check if the discarded tile can complete a set of non-sequential tiles i.e. NOT tiles with numbers
    if(discardedTile.index > 108) {
      if (playerTally[discardedTile.name] >= 2 ) {
        possibleMergeCombinations.push([discardedTile.name, discardedTile.name])
        highlightTilesToBeMergedWith([discardedTile.name],'same')
        return true
      }
      // highlight the tiles to be eaten
    } else {
      // deconstruct the discarded tile (numbered) to get the name and number
      let hasOutcome = false
      const discardedTileChar = discardedTile.name.substr(0,1) 
      const discardedTileNo = +discardedTile.name.substr(1,1)

      // if the discardedtile can complete a pair of duplicates or if the discardedtile can form part of a sequence e.g. X,_,_ || _,X,_ || _,_,X
      if (playerTally[discardedTile.name] == 2) {
        possibleMergeCombinations.push([discardedTile.name, discardedTile.name])
        highlightTilesToBeMergedWith([discardedTile.name],'same')
        hasOutcome = true
      } 
      if (playerTally[discardedTileChar+(discardedTileNo+1)] && playerTally[discardedTileChar+(discardedTileNo+2)]) {
        console.log(' X , _ , _ ')
        possibleMergeCombinations.push([discardedTileChar+(discardedTileNo+1), discardedTileChar+(discardedTileNo+2)])
        highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo+1),discardedTileChar+(discardedTileNo+2)],'first')
        hasOutcome = true
      } 
      if (playerTally[discardedTileChar+(discardedTileNo-1)] && playerTally[discardedTileChar+(discardedTileNo+1)]) {
        console.log(' _ , X , _ ')
        possibleMergeCombinations.push([discardedTileChar+(discardedTileNo-1), discardedTileChar+(discardedTileNo+1)])
        highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo-1),discardedTileChar+(discardedTileNo+1)],'middle')
        hasOutcome = true
      } 
      if (playerTally[discardedTileChar+(discardedTileNo-1)] && playerTally[discardedTileChar+(discardedTileNo-2)]) {
        console.log(' _ , _ , X ')
        possibleMergeCombinations.push([discardedTileChar+(discardedTileNo-1), discardedTileChar+(discardedTileNo-2)])
        highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo-1),discardedTileChar+(discardedTileNo-2)],'last')
        hasOutcome = true
      }

      return hasOutcome
    }
  }

}

const updateGameLog = () =>{
  gamelog.innerText = JSON.stringify(gameState,null,2)
}

const updateGameState = (type, playerNumber = 0) => {

  switch (type) {
    case 'nextround':
      ++gameState.windCount
      gameState.currentWind = WIND_TILES[gameState.windCount%4]
      gameState.currentPlayer = ++gameState.currentPlayer % 4
      gameState.currentTurnNo++
      updateGameLog()
      startRound()
      break;

    case 'drawtiles':
      gameState.tilesInHand++
      gameState.tilesToPlay--
      updateGameLog()
      break;

    case 'discardtiles':
      gameState.tilesInDiscard++
      gameState.tilesInHand--
      updateGameLog()
      break;

    case 'eattiles':
      gameState.tilesInDiscard--
      gameState.tilesInHand++
      gameState.currentPlayer = playerNumber // TODO: need to change this to reflect the player who clicked
      gameState.currentTurnNo++
      updateGameLog()
      startTimer(10, timerDisplay, PLAYERS[gameState.currentPlayer].skipTurn)
      break;

    case 'wingame':
      break;

    case 'gameover':
      timer.clearAll()
      updateGameLog()
      break;

    default:
      updateGameLog()
      break;
  }
}

// newGame(12,'east')
const newGame = (diceRolled, house) => {

  deckInPlay = buildDeck()

  // TODO: query for player name, wind, seatPosition
  // let player1 = new Player('player1', 'east', 1)
  // let player2 = new Player('player2', 'north', 2)
  // let player3 = new Player('player3', 'west', 3)
  // let player4 = new Player('player4', 'south', 4)

  PLAYERS = [
    new Player('player1', 'east', 0),
    new Player('player2', 'north', 1),
    new Player('player3', 'west', 2),
    new Player('player4', 'south', 3)
  ]

  // deliver the tiles to the players
  PLAYERS[0].drawTile(13)
  PLAYERS[1].drawTile(13)
  PLAYERS[2].drawTile(13)
  PLAYERS[3].drawTile(13)

  // TODO: replace this with database
  // PLAYERS.push(player1, player2, player3, player4)

}



const startRound = () => {
  // shift indicator to current player
  const currentPlayer = PLAYERS[gameState.currentPlayer]
  currentPlayer.drawTile()
  updateGameState('drawtiles')
  startTimer(10, timerDisplay, currentPlayer.skipTurn)
}

newGame()
startRound()



// timer starts
// checkwin -> if win, ask player and show winning amount
// wait for player to discard tile
// check for other players decision
// if no decision, change player state to next player





// given player tiles in hand and player checked tiles, return various combinations that can be made
// group by chow, group by pong,
// attempt to win
const combinationsOfGroupings = (playerTiles) => {

  // playerTiles comprise of playerHand (hidden) and playerChecked (played)
  // playerChecked should already be grouped since it's a winning combination
  // const totalHand = [...playerTiles.playerHand].push([...playerTiles.playerChecked])
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


const renderBoard = ()=> {

  // check game state
  if(gameState.tilesToPlay == 15) {
    updateGameState('gameover')
    return
  }

  const currentHand = PLAYERS[0].playerTiles.playerHand
  const currentChecked = PLAYERS[0].playerTiles.playerChecked.flat(2)
  const playerDiscarded = PLAYERS[0].playerTiles.playerDiscarded
  const playerHand = document.getElementById('playerHand');
  const playerChecked = document.getElementById('playerChecked');
  const playerDiscardPile = document.getElementById('playerDiscardPile') 
  playerChecked.innerText=''
  playerHand.innerText =''
  playerDiscardPile.innerText = ''

  // RENDER PLAYER HAND
  if(currentHand.length>0) {
    currentHand.forEach(playerTile => {
      const tileContainer = document.createElement('div')
      tileContainer.classList.add('tile', playerTile.name)
      tileContainer.id = playerTile.index
      tileContainer.addEventListener('click', (ev)=> {
        // immediately disable the clicking of other tiles
        if(gameState.currentPlayer == 0 ) {
          // discardTile(ev.target)
          const tileIndex = ev.target.parentElement.id
          const tileToBeRemoved = currentHand.find(tile=> tile.index == tileIndex)
          PLAYERS[0].discardTile(tileToBeRemoved)
        }
      })
      const tileImg = document.createElement('img')
      tileImg.src = playerTile.url;
      tileContainer.appendChild(tileImg)
      playerHand.appendChild(tileContainer)
    })

    currentChecked.forEach(playerTile => {
      const tileContainer = document.createElement('div')
      tileContainer.classList.add('tile')
      const tileImg = document.createElement('img')
      tileImg.src = playerTile.url;
      tileContainer.appendChild(tileImg)
      playerChecked.appendChild(tileContainer)
    })

    playerDiscarded.forEach(playerTile => {
      const tileContainer = document.createElement('div')
      tileContainer.id = playerTile.index
      tileContainer.classList.add('tile')
      const tileImg = document.createElement('img')
      tileImg.src = playerTile.url
      tileContainer.appendChild(tileImg)

      // insert into the dropzone randomly      
      playerDiscardPile.appendChild(tileContainer)
    })
  }


  // RENDER PLAYER DISPLAY OF OPPONENT TILES (hidden)
  for(let remainingPlayer = 0; remainingPlayer < PLAYERS.length-1; remainingPlayer +=1){
    const playerHands = ['leftPlayer','topPlayer','rightPlayer']
    const remainingPlayerHand = document.getElementById(`${playerHands[remainingPlayer]}Hand`);
    const remainingPlayerChecked = document.getElementById(`${playerHands[remainingPlayer]}Checked`);
    const playerDiscardPile = document.getElementById(`${playerHands[remainingPlayer]}Discard`)
    remainingPlayerChecked.innerText = ''
    remainingPlayerHand.innerText=''
    playerDiscardPile.innerText = ''
    const nextPlayerHand = PLAYERS[remainingPlayer+1].playerTiles.playerHand
    const nextPlayerChecked = PLAYERS[remainingPlayer+1].playerTiles.playerChecked
    const nextPlayerDiscarded = PLAYERS[remainingPlayer+1].playerTiles.playerDiscarded

    if(nextPlayerHand.length>0) {
      nextPlayerHand.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile')
        const tileImg = document.createElement('img')
        tileImg.style.backgroundColor = 'brown'
        tileContainer.appendChild(tileImg)
        remainingPlayerHand.appendChild(tileContainer)
      })
    }

    if(nextPlayerChecked.length > 0 ) {
      nextPlayerChecked.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile')
        const tileImg = document.createElement('img')
        tileImg.src = playerTile.url
        tileContainer.appendChild(tileImg)
        remainingPlayerChecked.appendChild(tileContainer)
      })
    }

    if(nextPlayerDiscarded.length > 0 ) {
      nextPlayerDiscarded.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile')
        const tileImg = document.createElement('img')
        tileImg.src = playerTile.url
        tileContainer.appendChild(tileImg)
        playerDiscardPile.appendChild(tileContainer)
      })
    }
  }

  // RENDER EAT POSSIBILITY
  
  // reset merge combinations
  possibleMergeCombinations = []
  console.log(refDeck())

  const playerControls = document.getElementById('playerControls').getElementsByClassName('content')[3]

  // [0,2,3] -> [3,1,2]
  const justDiscarded = PLAYERS[(gameState.currentPlayer+7) % 4].playerTiles.playerDiscarded
    // activate when discard pile is not empty and not player's own discard
  
  if(justDiscarded.length > 0 && gameState.currentPlayer != 1  ) {
    console.log('CHECKING EAT POSSIBILITY')
    const lastDiscardedTile = justDiscarded[justDiscarded.length-1]
    if(PLAYERS[0].checkIfCanBeEaten(lastDiscardedTile)) {
      
      let set = new Set(possibleMergeCombinations.map(JSON.stringify))
      let possibleUniqueCombinations = Array.from(set).map(JSON.parse)

      // give the player options which one to eat
      possibleUniqueCombinations.forEach(combo => {
        const eatDiscardedTile = document.createElement('button')
        for(const tileName of combo) {
          eatDiscardedTile.textContent += refDeck()[tileName]
        }

        eatDiscardedTile.addEventListener('click', (ev)=> {
          // TODO: eat the tiles based on the combinations
          const tileCombiToCheck = ev.target.textContent.split(',')
          PLAYERS[0].eatTile(lastDiscardedTile, tileCombiToCheck)
        })
        playerControls.appendChild(eatDiscardedTile)
      })
      

    } else {
      playerControls.innerText = "NOTHING TO EAT"
    }
  }

}

renderBoard()


 


// take in simplified hand first
// e.g. console.log(showHandCombinations(PLAYERS[0].showSimplifiedHand())
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

// console.log("Combinations", showHandCombinations(PLAYERS[0].showSimplifiedHand()))

