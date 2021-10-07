
// Interstitial displays the pre-game chat function, the players that are waiting for game to start. Also allows the players to select which wind they want to be in and whether they are ready to start the game.
import Chat from '/js/rooms/interstitial/chat.js'

// ref from https://github.com/markmandel/happy-angry-surprised/blob/master/html/js/chat.js

// Application starts by loading the in-room users and chat functionality
window.onload = () => {
  // showUsers.init()
  Chat().init()
}

