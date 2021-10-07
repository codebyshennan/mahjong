

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