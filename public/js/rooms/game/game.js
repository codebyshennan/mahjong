import {refDeck, buildDeck} from '../../utils/makeDeck.js'
import sortHand from '../../utils/sorthand.js'
import {timer, startTimer} from '../../utils/timer.js'
import diceRoll from '../../utils/diceroll.js'
import { WIND_TILES, ANIMAL_TILES, FLOWER_TILES} from '../../tileset.js'
import Player from './Player.js'
import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'

import { ref, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'

// 
const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const db = getDatabase(firebase)
connectDatabaseEmulator(db,"localhost",9000)

const loggedInUser = {}

onAuthStateChanged(auth, (user)=>{
  if(user) {
  // loggedInUser[accessToken] = await user.accessToken;
      loggedInUser['displayName'] = user.displayName;
      loggedInUser['uid'] = user.uid;
      loggedInUser['photoURL'] = user.photoURL;
      console.log(loggedInUser)
    } else {
      // user is signed out
      window.location.pathname = '/login'
  }
})

let PLAYERS = []
let possibleMergeCombinations = []
let deckInPlay


// to write to db
const playerDBRef = ref(db, 'game/${gameId}/players')
// listen to other player's discarded tiles
const playerQuery = query(playerDBRef, orderByChild('playerDiscarded'), equalTo(`${playerId}`)) 

// update gameState
/** @type {*} */
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

/**
 * Updates to the overall game state depending on the actions that were taken by a player
 *
 * @param {string} type
 * @param {number} [playerNumber=0]
 */
const updateGameState = (type, playerNumber = 0) => {

  const updateGameLog = () =>{
    const gamelog = document.getElementById('gamelog')
    gamelog.innerText = JSON.stringify(gameState,null,2)
  }

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
      const timerDisplay = document.getElementById('timer')
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
/**
 * Begins a new game instance
 *
 * @param {number} diceRolled
 * @param {string} house
 */
const newGame = (diceRolled, house) => {

  deckInPlay = buildDeck()

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

/**
 * Begins a new round
 *
 */
const startRound = () => {
  // shift indicator to current player
  const currentPlayer = PLAYERS[gameState.currentPlayer]
  currentPlayer.drawTile()
  updateGameState('drawtiles')
  const timerDisplay = document.getElementById('timer')
  startTimer(10, timerDisplay, currentPlayer.skipTurn)
}

newGame()
startRound()

/**
 * Renders the game board through DOM manipulation
 *
 */
const renderBoard = ()=> {

  // check game state
  if(gameState.tilesToPlay == 15) {
    updateGameState('gameover')
    return
  }

  const currentHand = PLAYERS[0].playerHand
  const currentChecked = PLAYERS[0].playerChecked.flat(2)
  const playerDiscarded = PLAYERS[0].playerDiscarded
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
    const nextPlayerHand = PLAYERS[remainingPlayer+1].playerHand
    const nextPlayerChecked = PLAYERS[remainingPlayer+1].playerChecked
    const nextPlayerDiscarded = PLAYERS[remainingPlayer+1].playerDiscarded

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
  const justDiscarded = PLAYERS[(gameState.currentPlayer+7) % 4].playerDiscarded
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
