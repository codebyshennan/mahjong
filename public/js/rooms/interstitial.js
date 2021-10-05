// initialise socket.io

const socket = io('/lobby')

// tell the server which ones ready
socket.emit('start-game', userid)


