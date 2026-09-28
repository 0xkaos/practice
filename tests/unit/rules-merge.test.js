import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { mergePracticeRules } from '../../scripts/merge-practice-rules.js'

const fragment = readFileSync('firebase/practice.rules.fragment', 'utf8')
const source = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /existing/{id} { allow read: if true; }\n  }\n}\n"

test('managed rules are additive and the merge is idempotent', () => {
  const merged = mergePracticeRules(source, fragment)
  assert.ok(merged.includes('match /existing/{id} { allow read: if true; }'))
  assert.equal(merged.replace('\n\n' + fragment.trimEnd(), ''), source)
  assert.equal(mergePracticeRules(merged, fragment), merged)
})

test('emulator rules contain exactly the tested production fragment', () => {
  const snapshot = readFileSync('firebase/firestore.rules', 'utf8')
  assert.ok(snapshot.includes(fragment.trimEnd()))
  assert.equal(mergePracticeRules(snapshot, fragment), snapshot)
})

test('unsafe or ambiguous rule sources fail closed', () => {
  assert.throws(() => mergePracticeRules('not firestore rules', fragment))
  assert.throws(() => mergePracticeRules(source.replace('/existing/', '/phrasePractice/'), fragment))
  assert.throws(() => mergePracticeRules(source + '\n    // END phrases-practice', fragment))
})
