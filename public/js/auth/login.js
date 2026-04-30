import { auth } from '../firebase-init.js'
import { signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, GoogleAuthProvider, FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";

const GoogleProvider = new GoogleAuthProvider();
const FacebookProvider = new FacebookAuthProvider();
// const facebookProvider = new firebase.auth.FacebookAuthProvider()

onAuthStateChanged(auth, (user)=> {
  if(user) {
    window.location.pathname ='/lobby'
  }
})


document
  .getElementById('googlesignin')
  .addEventListener('click', (event)=>{
    event.preventDefault();
    signInWithPopup(auth, GoogleProvider)
      .then((result)=> {
        window.location.pathname = '/lobby'
      })
  })

document
  .getElementById('facebooksignin')
  .addEventListener('click', (event)=>{
    event.preventDefault();
    signInWithPopup(auth, FacebookProvider)
      .then((result)=> {
        window.location.pathname = '/lobby'
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