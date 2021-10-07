import firebaseConfig from '../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, connectAuthEmulator, GoogleAuthProvider, FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";

const firebase = initializeApp(firebaseConfig)
// const db = getDatabase(firebase)

const auth = getAuth()
connectAuthEmulator(auth, "http://localhost:9099")
const GoogleProvider = new GoogleAuthProvider();
const FacebookProvider = new FacebookAuthProvider();
// const facebookProvider = new firebase.auth.FacebookAuthProvider()

onAuthStateChanged(auth, (user)=> {
  if(user) {
    console.log(user.uid)
    // auth.currentUser.getIdToken(/* forceRefresh */ true).then(idToken => {
    //       axios.post('/login', {
    //         idToken: idToken
    //       })
    //     })
  }
})

document
  .getElementById('googlesignin')
  .addEventListener('click', (event)=>{
    event.preventDefault();
    signInWithPopup(auth, GoogleProvider)
      .then((result)=> {
        const credential = GoogleAuthProvider.credentialFromResult(result)
        const token = credential.accessToken
        const user = result.user 

        console.log(credential)
        console.log(token)
        console.log(user)
        window.location.path = '/register'
      })
  })

document
  .getElementById('facebooksignin')
  .addEventListener('click', (event)=>{
    event.preventDefault();
    signInWithPopup(auth, FacebookProvider)
      .then((result)=> {
        const credential = FacebookAuthProvider.credentialFromResult(result)
        const token = credential.accessToken
        const user = result.user 

        console.log(credential)
        console.log(token)
        console.log(user.uid)
      })
  })





// firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
  // .then(()=>{
  //   window.localStorage.setItem('emailForSignIn',email)
  // })

  // // if(firebase.auth().isSignInWithEmailLink(window.location.href)) {
  //   const email = window.localStorage.getItem('emailForSignIn')
  //   firebase.auth().signInWithEmailLink(email, window.location.href)
  // }