import { ref, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'

  /**
   * Send a chat message to the database
   *
   */
  const sendMessage = () => {
    const newMessage = {
      name: loggedInUser.displayName,
      message: messageField.value
    }
    set(push(chatRef), newMessage)
  }

  // Add a chat message to the chat UI
  const addChatMessage = (name, message) => {
    const item = document.createElement('li')
    item.innerHTML = `<strong>${name}</strong> ${message}`

    const messageList = messages.querySelector('ul')
    messageList.appendChild(item)
    messages.scrollTop = messageList.scrollHeight;
  }
  
  const sendButton = document.getElementById('send-chat')
  const messageField = document.getElementById('chat-message')
  const messages = document.getElementById('chat-messages')
  // TODO: build the chat UI
  sendButton.addEventListener('click', sendMessage)
  const chatRef = ref(rtdb, `interstitial/${roomId}/chats/`)
  onChildAdded(chatRef, (snapshot)=> {
    const message = snapshot.val()
    addChatMessage(message.name, message.message)
  })