import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// Firebase web configuration is public, not a server credential. Access is
// controlled by Firebase Auth and the owner-scoped Firestore security rules.
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
const app = initializeApp({
  apiKey: 'AIzaSyBClFaGIX-1o5q8wQOLs1hPnqw-KtVx-Ek',
  authDomain: 'alephbetical-11f49.firebaseapp.com',
  projectId: 'alephbetical-11f49',
  appId: '1:506376120818:web:6f06a04c8489b031ad636b',
  ...(useEmulators ? { projectId: 'demo-phrases', apiKey: 'demo-api-key', authDomain: 'demo-phrases.firebaseapp.com' } : {}),
})

export const auth = getAuth(app)
export const db = getFirestore(app)

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:19099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 18080)
}

export function signIn() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(auth, provider)
}

export const logOut = () => signOut(auth)
