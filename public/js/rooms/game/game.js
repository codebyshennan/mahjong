import {timer, startTimer} from '../../utils/timer.js'
import Player from '../Player.js'
import { buildDeck } from '../../utils/makeDeck.js'
import splitDeck from '../../utils/splitdeck.js'


// STARTUP THE APPLICATION
window.addEventListener('DOMContentLoaded', async () => {
  let deckInPlay= buildDeck()
  let player1, player2, player3, player4
  let playerList = [player1, player2, player3, player4]
  let gameState = {
        players: [],
        windCount: 0,
        currentWind: 'east',
        currentPlayer: 0,
        currentTurnNo: 0,
        currentHouse: 'east',
        diceRolled: 0,
        timeStarted: new Date(),
        tilesInDiscard: 0,
        tilesInHands: 0,
        tilesToPlay: 148
      }
  const winds = ["east","south","west","north"]
  const direction = ["main", "right","top","left"]
  const chineseChars = {
    'east': "东",
    'south': "南",
    'west': "西",
    'north': "北",
  }

  const renderPlayerTiles = (direction, hand, check, discard) => {
    const playerHand = document.getElementById(`${direction}PlayerHand`);
    const playerChecked = document.getElementById(`${direction}PlayerChecked`);
    const playerDiscardPile = document.getElementById(`${direction}PlayerDiscard`) 
    playerChecked.innerText = ''
    playerHand.innerText = ''
    playerDiscardPile.innerText = ''

    // RENDER PLAYER HAND
    if(hand.length>0) {
      hand.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile', playerTile.name)
        tileContainer.id = playerTile.index
        tileContainer.addEventListener('click', (ev)=> {
          // immediately disable the clicking of other tiles
          if(gameState.currentPlayer == 0 ) {
            // discardTile(ev.target)
            const tileIndex = ev.target.parentElement.id
            const tileToBeRemoved = hand.find(tile=> tile.index == tileIndex)
            currentPlayer.discardTile(tileToBeRemoved)

            timer.clearAll()
            updateGameState(gameState,'discardtiles')
            updateGameState(gameState,'nextround')
            renderPlayerTiles(currentPlayer.playerHand,
                              currentPlayer.playerChecked, 
                              currentPlayer.playerDiscarded)
          }
        })
        const tileImg = document.createElement('img')
        tileImg.src = playerTile.url;
        tileContainer.appendChild(tileImg)
        playerHand.appendChild(tileContainer)
      })

      check.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile')
        const tileImg = document.createElement('img')
        tileImg.src = playerTile.url;
        tileContainer.appendChild(tileImg)
        playerChecked.appendChild(tileContainer)
      })

      discard.forEach(playerTile => {
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
  }

  for(let i=0; i< playerList.length; i++) {
    playerList[i] = new Player(i, `${i}`, winds[i], i, 1000)
    playerList[i].drawTile(deckInPlay, 13)
    renderPlayerTiles(direction[i], playerList[i].playerHand, playerList[i].playerChecked, playerList[i].playerDiscarded)
  }
})

