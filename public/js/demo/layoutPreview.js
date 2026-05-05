const previewUser = {
  uid: 'preview-user',
  displayName: 'Layout Preview',
  photoURL: null,
}

const previewPlayers = [
  { uid: 'preview-east', displayName: 'Ari', wind: 'east', ready: true },
  { uid: 'preview-south', displayName: 'Bao', wind: 'south', ready: true },
  { uid: 'preview-west', displayName: 'Chloe', wind: 'west', ready: false },
  { uid: 'preview-north', displayName: 'Dev', wind: 'north', ready: true },
]

const tileImages = [
  '/assets/wikitiles/MJt1.png',
  '/assets/wikitiles/MJt2.png',
  '/assets/wikitiles/MJt3.png',
  '/assets/wikitiles/MJs4.png',
  '/assets/wikitiles/MJs5.png',
  '/assets/wikitiles/MJs6.png',
  '/assets/wikitiles/MJd1.png',
  '/assets/wikitiles/MJd2.png',
  '/assets/wikitiles/MJd3.png',
  '/assets/wikitiles/MJh1.png',
  '/assets/wikitiles/MJh2.png',
  '/assets/wikitiles/MJh3.png',
  '/assets/wikitiles/MJf1.png',
  '/assets/wikitiles/MJf2.png',
]

const setText = (selector, text) => {
  const element = document.querySelector(selector)
  if (element) {
    element.textContent = text
  }
}

const makeTile = (src = tileImages[0]) => {
  const wrapper = document.createElement('div')
  wrapper.className = 'tile'
  const image = document.createElement('img')
  image.src = src
  image.alt = ''
  wrapper.appendChild(image)
  return wrapper
}

const fillTiles = (selector, count, offset = 0) => {
  const element = document.querySelector(selector)
  if (!element) {
    return
  }
  element.innerHTML = ''
  for (let index = 0; index < count; index += 1) {
    element.appendChild(makeTile(tileImages[(index + offset) % tileImages.length]))
  }
}

const addChatLine = (message) => {
  const list = document.querySelector('#chat-messages ul')
  if (!list) {
    return
  }
  const item = document.createElement('li')
  item.textContent = message
  list.appendChild(item)
}

const setupNav = () => {
  setText('#userName', `Welcome ${previewUser.displayName}`)
  const logout = document.querySelector('#logout')
  if (logout) {
    logout.addEventListener('click', () => {
      window.location.pathname = '/login'
    })
  }
}

const buildRoomCard = (room) => {
  const roomItem = document.createElement('div')
  roomItem.classList.add('card', 'horizontal')

  const cardImg = document.createElement('div')
  cardImg.className = 'card-image'
  cardImg.style.cssText = 'background-image: url(https://static.vecteezy.com/system/resources/thumbnails/000/124/091/small/mahjong-hand-drawn-vector.jpg); background-repeat: no-repeat; min-width: 300px;'
  roomItem.appendChild(cardImg)

  const cardStacked = document.createElement('div')
  cardStacked.className = 'card-stacked'

  const cardContent = document.createElement('div')
  cardContent.className = 'card-content'
  cardContent.textContent = `${room.playerCount} / 4 ${room.state}`

  const cardAction = document.createElement('a')
  cardAction.className = 'card-action join-room'
  cardAction.href = '/demo/interstitial'
  cardAction.textContent = room.action

  cardStacked.appendChild(cardContent)
  cardStacked.appendChild(cardAction)
  roomItem.appendChild(cardStacked)
  return roomItem
}

const previewLobby = () => {
  const createRoom = document.querySelector('#create-room')
  if (createRoom) {
    createRoom.textContent = 'CREATE ROOM'
    createRoom.addEventListener('click', () => {
      window.location.pathname = '/demo/interstitial'
    })
  }

  const roomList = document.querySelector('#roomList')
  if (roomList) {
    roomList.appendChild(buildRoomCard({ playerCount: 3, state: 'JOINED', action: 'JOIN ARI ROOM' }))
    roomList.appendChild(buildRoomCard({ playerCount: 1, state: 'OPEN', action: 'GO BACK TO YOUR CRIB' }))
  }

  addChatLine('🟢 Ari')
  addChatLine('🟢 Bao')
  addChatLine('🟢 Chloe')
  addChatLine('🔴 Dev')
}

const previewInterstitial = () => {
  const container = document.querySelector('#playerContainers')
  if (container) {
    previewPlayers.forEach((player, index) => {
      const card = document.createElement('div')
      card.className = `card col s6 ${player.ready ? '' : 'deactivated'}`
      card.innerHTML = `
        <div class="card-content">
          <p style="font-weight: bold">${player.displayName}</p>
          <div class="playerWind">${['東', '南', '西', '北'][index]}</div>
        </div>
        <div class="${player.ready ? 'readiness' : 'card-action'}">${player.ready ? 'READY' : 'WAITING'}</div>
      `
      container.appendChild(card)
    })
  }

  addChatLine('Ari created the room.')
  addChatLine('Bao joined.')
  addChatLine('Chloe is choosing a wind.')

  const sendButton = document.querySelector('#send-chat')
  if (sendButton) {
    sendButton.textContent = 'Preview'
  }
}

const previewGame = () => {
  setText('#mainSeatLabel', 'You · East')
  setText('#topSeatLabel', 'Bao · South')
  setText('#rightSeatLabel', 'Chloe · West')
  setText('#leftSeatLabel', 'Dev · North')
  document.querySelector('#mainSeatLabel')?.classList.add('is-active')

  fillTiles('#playerHand', 14)
  fillTiles('#playerChecked', 3, 8)
  fillTiles('#topPlayerHand', 13)
  fillTiles('#rightPlayerHand', 13)
  fillTiles('#leftPlayerHand', 13)
  fillTiles('#topPlayerChecked', 3, 1)
  fillTiles('#rightPlayerChecked', 3, 4)
  fillTiles('#leftPlayerChecked', 3, 7)
  fillTiles('#playerDiscardPile', 9, 2)
  fillTiles('#topPlayerDiscard', 8, 5)
  fillTiles('#rightPlayerDiscard', 7, 8)
  fillTiles('#leftPlayerDiscard', 6, 11)

  setText('.bottomcontrols .playerWind', '東')
  setText('.rightcontrols .playerWind', '西')
  setText('.topcontrols .playerWind', '南')
  setText('.leftcontrols .playerWind', '北')
  setText('#timer', '10')
  setText('#turnBanner', 'Previewing table layout')

  addChatLine('Ari: pong?')
  addChatLine('Bao: pass')
  addChatLine('Chloe: your turn')
}

setupNav()

if (document.querySelector('#roomList')) {
  previewLobby()
} else if (document.querySelector('#playerContainers')) {
  previewInterstitial()
} else if (document.querySelector('.board')) {
  previewGame()
}
