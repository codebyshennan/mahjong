import { auth } from '../firebase-init.js'
import { signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";

const GoogleProvider = new GoogleAuthProvider();
const FacebookProvider = new FacebookAuthProvider();

onAuthStateChanged(auth, (user)=> {
  if(user) {
    window.location.pathname ='/lobby'
  }
})

document
  .getElementById('registerUser')
  ?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    try {
      await signInWithEmailAndPassword(auth, email, password)
      window.location.pathname = '/lobby'
    } catch (err) {
      console.error('Login error:', err.code, err.message)
      if (window.toastr) {
        toastr.error('Login failed. Check your email and password.')
      } else {
        alert('Login failed. Check your email and password.')
      }
    }
  })

document
  .getElementById('googlesignin')
  ?.addEventListener('click', (event)=>{
    event.preventDefault()
    signInWithPopup(auth, GoogleProvider)
      .then(()=> {
        window.location.pathname = '/lobby'
      })
  })

document
  .getElementById('facebooksignin')
  ?.addEventListener('click', (event)=>{
    event.preventDefault()
    signInWithPopup(auth, FacebookProvider)
      .then(()=> {
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
