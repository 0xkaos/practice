import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

export function watchAttempts(uid, onResults, onError) {
  // All saved attempts are needed for genuine cumulative totals and previous
  // scores. No migration or additional write permissions are required.
  const attempts = query(collection(db, 'phrasePractice', uid, 'attempts'), orderBy('createdAt', 'desc'))
  return onSnapshot(attempts, (snapshot) => {
    onResults(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
  }, onError)
}

export function saveAttempt(uid, attempt) {
  const target = doc(db, 'phrasePractice', uid, 'attempts', attempt.id)
  const { id: _id, ...data } = attempt
  // A retry must not create another attempt or count an answer twice.
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(target)
    if (!existing.exists()) transaction.set(target, { ...data, createdAt: serverTimestamp() })
  })
}
