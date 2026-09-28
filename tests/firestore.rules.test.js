import { after, before, beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

let environment
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-phrases',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: 18080 },
  })
})
beforeEach(async () => { await environment.clearFirestore() })
after(async () => { await environment?.cleanup() })

const valid = () => ({ sentenceId: '556413', answer: 'I wonder if it will rain tomorrow.', score: 100, exact: true, referenceIndex: 0, assisted: false, translationVersion: 'canonical-v1', gradingVersion: 'ordered-v2', createdAt: serverTimestamp() })
const target = (db, uid = 'alice', id = randomUUID()) => doc(db, 'phrasePractice', uid, 'attempts', id)

test('owner can save, read, list, and delete their results', async () => {
  const db = environment.authenticatedContext('alice').firestore()
  const reference = target(db)
  await assertSucceeds(setDoc(reference, valid()))
  await assertSucceeds(getDoc(reference))
  await assertSucceeds(getDocs(query(collection(db, 'phrasePractice', 'alice', 'attempts'), orderBy('createdAt', 'desc'), limit(20))))
  await assertSucceeds(deleteDoc(reference))
})

test('anonymous and other users cannot read or write someone’s results', async () => {
  for (const db of [environment.unauthenticatedContext().firestore(), environment.authenticatedContext('bob').firestore()]) {
    await assertFails(setDoc(target(db), valid()))
    await assertFails(getDoc(target(db)))
    await assertFails(getDocs(collection(db, 'phrasePractice', 'alice', 'attempts')))
    await assertFails(deleteDoc(target(db)))
  }
})

test('invalid schemas, scores, lengths, versions and timestamps are rejected', async () => {
  const db = environment.authenticatedContext('alice').firestore()
  for (const patch of [{ score: 101 }, { score: -1 }, { score: 99.5 }, { score: 80, exact: true }, { answer: '' }, { answer: 'a'.repeat(501) }, { referenceIndex: 3 }, { assisted: 'no' }, { unexpected: true }, { translationVersion: 'unreviewed' }, { gradingVersion: 'anything' }, { createdAt: new Date(0) }]) {
    await assertFails(setDoc(target(db), { ...valid(), ...patch }))
  }
  const incomplete = valid()
  delete incomplete.answer
  await assertFails(setDoc(target(db), incomplete))
})

test('submitted attempts are immutable', async () => {
  const db = environment.authenticatedContext('alice').firestore()
  const reference = target(db)
  await assertSucceeds(setDoc(reference, valid()))
  await assertFails(updateDoc(reference, { answer: 'Changed answer' }))
})

test('existing profile rules remain owner-only and usage stats stay read-only', async () => {
  const db = environment.authenticatedContext('alice').firestore()
  await assertSucceeds(setDoc(doc(db, 'user_profiles', 'alice'), { name: 'Alice' }))
  await assertFails(setDoc(doc(db, 'user_profiles', 'bob'), { name: 'Alice' }))
  await assertFails(setDoc(doc(db, 'user_profiles', 'alice', 'usageStats', '2026-09'), { count: 1 }))
  await assertSucceeds(setDoc(doc(db, 'users', 'alice', 'saved_contexts', 'example'), { example: true }))
})
