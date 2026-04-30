import { auth, fsdb } from '../../firebase-init.js'
import { startDBSync } from '../../presence.js'
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { increment, collection, getDocs, doc, getDoc, setDoc, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'

window.addEventListener('DOMContentLoaded', async ()=> {
  document.getElementById('logout').addEventListener('click', (ev)=> {
    ev.preventDefault()
    signOut(auth).then(()=> {
      window.location.pathname ='/login'
    })
  })

  let loggedInUser = {}

  // LOBBY STATES
  const ROOM_STATE = { OPEN: 1, JOINED: 2, FULL: 3 }
  const wind = {0: 'east', 1:'south',2:'west',3:'north'}

  onAuthStateChanged(auth, (user)=>{
    if(user) {
    // loggedInUser[accessToken] = await user.accessToken;
        loggedInUser['displayName'] = user.displayName;
        loggedInUser['uid'] = user.uid;
        loggedInUser['photoURL'] = user.photoURL;
        const userName = document.getElementById('userName');
        userName.innerText = `Welcome ${user.displayName}`
        startDBSync(loggedInUser)
      } else {
        // user is signed out
        // window.location.pathname = '/login'
    }
  })

  const messages = document.getElementById('chat-messages')

  // Add a chat message to the chat UI
  const addChatMessage = (name, message) => {
    const item = document.createElement('li')
    const nameNode = document.createElement('strong')
    nameNode.textContent = name
    item.appendChild(nameNode)
    item.appendChild(document.createTextNode(' ' + message))
    const messageList = messages.querySelector('ul')
    messageList.appendChild(item)
    messages.scrollTop = messageList.scrollHeight;
  }

  // CHECK IF EVERYONE IS ONLINE
    const queryForOnlineUsers = query(collection(fsdb, 'online'), where('state','==','online'))
    onSnapshot(queryForOnlineUsers,(snapshot)=>{
      snapshot.docChanges().forEach((change)=> {
        if(change.type=="added") {
          const online = '🟢'
          addChatMessage(online, change.doc.data().displayName)
        }

        if(change.type=="removed") {
          [...document.querySelectorAll('li')].forEach( (item) => {
            if (item.innerText.includes(change.doc.data().displayName) && item.innerText.includes('🟢')) {
              item.parentNode.removeChild(item)
            }
          })
        }
      })
    })

    const queryForOfflineUsers = query(collection(fsdb, 'online'), where('state','==','offline'))
    onSnapshot(queryForOfflineUsers,(snapshot)=>{
      snapshot.docChanges().forEach((change)=> {
        if(change.type=="added") {
          const offline = '🔴'
          addChatMessage(offline, change.doc.data().displayName)
        }

        if(change.type=="removed") {
          [...document.querySelectorAll('li')].forEach( (item) => {
            if (item.innerText.includes(change.doc.data().displayName) && item.innerText.includes('🔴')) {
              item.parentNode.removeChild(item)
            }
          })
        }
      })
    })

  const joinRoom = async (key) =>{
    console.log('Attempting to join game of key: ', key)
    const userOwnedRoomQuery = doc(fsdb,'lobby', key)
    const snapshot = await getDoc(userOwnedRoomQuery)

    if(snapshot.data().host.uid == loggedInUser.uid) {
      window.location.pathname = `/interstitial/${key}`
    } else {
      try {
          await runTransaction(fsdb, async (transaction) => {
            const room = await transaction.get(doc(fsdb, 'lobby', key))
            if(!room.exists()){
              throw "Room does not exist!"
            }
            if (room.data().playerCount >= 4) {
              throw "Room is full!"
            }

            const newPlayer = {
                uid: loggedInUser.uid,
                displayName: loggedInUser.displayName,
                photoURL: loggedInUser.photoURL,
              }

            transaction.update(doc(fsdb, 'lobby', key), { "players": arrayUnion(newPlayer), "state": ROOM_STATE.JOINED, "playerCount": increment(1)})
        }).then(()=> {
          window.location.pathname = `/interstitial/${key}`
        })
      } catch (error) {
        console.error(error)
      }
        
    }
  }


  /**
   * For each room that was created,
   *
   * @param {*} key
   * @param {*} room
   */
  const buildRoomCard = (key, contentText, actionText) => {
    const roomItem = document.createElement('div')
    roomItem.id = key
    roomItem.classList.add('card', 'horizontal')

    const cardImg = document.createElement('div')
    cardImg.className = 'card-image'
    cardImg.style.cssText = 'background-image: url(https://static.vecteezy.com/system/resources/thumbnails/000/124/091/small/mahjong-hand-drawn-vector.jpg); background-repeat: no-repeat; min-width: 300px;'
    roomItem.appendChild(cardImg)

    const cardStacked = document.createElement('div')
    cardStacked.className = 'card-stacked'

    const cardContent = document.createElement('div')
    cardContent.className = 'card-content'
    cardContent.textContent = contentText

    const cardAction = document.createElement('div')
    cardAction.className = 'card-action join-room'
    cardAction.textContent = actionText

    cardStacked.appendChild(cardContent)
    cardStacked.appendChild(cardAction)
    roomItem.appendChild(cardStacked)
    return roomItem
  }

  const addRoomInvitation = (key, room) => {
    const stateLabel = Object.keys(ROOM_STATE)[room.state]
    const hostName = room.host.displayName.toUpperCase()
    const roomItem = buildRoomCard(key, `${room.playerCount} / 4  ${stateLabel}`, `JOIN ${hostName} ROOM`)
    roomItem.addEventListener('click', () => joinRoom(key))
    document.getElementById('roomList').appendChild(roomItem)
  }

  const addOwnRoom = (key, room) => {
    const stateLabel = Object.keys(ROOM_STATE)[room.state]
    const roomItem = buildRoomCard(key, `${room.playerCount} / 4  ${stateLabel}`, 'GO BACK TO YOUR CRIB')
    roomItem.addEventListener('click', () => joinRoom(key))
    document.getElementById('roomList').appendChild(roomItem)
  }

  //  READ ONCE AND THEN LISTEN INDIVIDUALLY TO EACH ROOM FOR CHANGES
  const lobbyRooms = collection(fsdb, "lobby")
  onSnapshot(lobbyRooms, rooms => {
    const roomList = document.getElementById('roomList')
    roomList.innerHTML = ''
    rooms.forEach( room => {
      const createdRoom = room.data()
        if(createdRoom.host.uid != loggedInUser.uid ) {
          addRoomInvitation(room.id, createdRoom)
        } else {
          addOwnRoom(room.id, createdRoom)
        }
      }
    )
  })


  const createRoom = async() => {
    console.log('Creating a game room...')
    const currentGame = {
      host: {
        uid: loggedInUser.uid,
        displayName: loggedInUser.displayName,
        photoURL: loggedInUser.photoURL,
        playerWind: wind[0],
        playerNo: 0
      },
      state: ROOM_STATE.OPEN,
      players: [],
      playerCount: 1,
    }

    // CHECK IF YOU'VE ALREADY CREATED A ROOM
    // if have, disable the add room functionality
    const userOwnedRoomQuery = query(collection(fsdb, 'lobby'), where('host.uid', '==', `${loggedInUser.uid}`))
    const hostedRoom = await getDocs(userOwnedRoomQuery)
    console.log(hostedRoom)
    if(!hostedRoom.empty) {
      toastr.error('You can only host one room at a time.')
    } else {
        const roomDetail = await addDoc(collection(fsdb, "lobby"), currentGame)
        window.location.pathname = `/interstitial/${roomDetail.id}`
    }
  }

  const createRmBtn = document.getElementById('create-room');
  createRmBtn.addEventListener('click', createRoom)
    // join an open game with the available key
})