import assert from 'node:assert/strict'
import test from 'node:test'
import { GUEST_PROGRESS_KEY, mergeAttempts, readGuestProgress, summarizeAttempts, writeGuestProgress } from '../../src/progress.js'

const attempt = (id, score, extra = {}) => ({ id, sentenceId: 'phrase', score, assisted: false, completedAt: Number(id) || 0, ...extra })

test('cumulative points and accuracy include partial and zero-point answers', () => {
  const summary = summarizeAttempts([attempt('1', 100), attempt('2', 72), attempt('3', 0)])
  assert.equal(summary.points, 172)
  assert.equal(summary.count, 3)
  assert.equal(summary.accuracy, 57.3)
  assert.equal(summarizeAttempts([]).accuracy, null)
})

test('the previous score is the latest attempt, not the best score', () => {
  const summary = summarizeAttempts([attempt('2', 0), attempt('1', 100), attempt('3', 80, { sentenceId: 'another' })])
  assert.equal(summary.previousBySentence.get('phrase').score, 0)
  assert.equal(summary.previousBySentence.get('another').score, 80)
})

test('all-time totals include more than 20 attempts and never round to a false perfect', () => {
  const records = Array.from({ length: 25 }, (_, i) => attempt(String(i), i ? 100 : 99))
  const summary = summarizeAttempts(records)
  assert.equal(summary.count, 25)
  assert.equal(summary.points, 2499)
  assert.equal(summary.accuracy, 99.9)
})

test('optimistic and saved attempts merge without double-counting', () => {
  const local = [attempt('1', 100), attempt('2', 50)]
  const saved = [attempt('1', 100, { createdAt: { toMillis: () => 200 } })]
  const merged = mergeAttempts(saved, local)
  const summary = summarizeAttempts(merged)
  assert.equal(summary.points, 150)
  assert.equal(summary.count, 2)
  assert.equal(summary.previousBySentence.get('phrase').id, '1')
  assert.equal(merged.find((entry) => entry.id === '1').completedAt, 1)
  assert.equal(summarizeAttempts([...local, ...local]).count, 2)
})

test('malformed and legacy assisted attempts do not affect totals', () => {
  const records = [null, {}, attempt('1', 100, { assisted: true }), attempt('2', 101), attempt('3', -1), attempt('4', 0.5), attempt('5', 80)]
  assert.equal(summarizeAttempts(records).points, 80)
  assert.equal(summarizeAttempts(records).count, 1)
})

test('guest history round-trips through session storage and tolerates blocked storage', () => {
  const data = new Map()
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) }
  const records = [attempt('1', 100), attempt('2', 0)]
  writeGuestProgress(storage, records)
  assert.deepEqual(readGuestProgress(storage), records)
  data.set(GUEST_PROGRESS_KEY, '{broken')
  assert.deepEqual(readGuestProgress(storage), [])
  data.set(GUEST_PROGRESS_KEY, '{"not":"an array"}')
  assert.deepEqual(readGuestProgress(storage), [])
  data.set(GUEST_PROGRESS_KEY, '[null,{}, {"id":"1","sentenceId":"s","score":72}]')
  assert.equal(readGuestProgress(storage).length, 1)
  const blocked = { getItem() { throw new Error('Blocked') }, setItem() { throw new Error('Full') } }
  assert.deepEqual(readGuestProgress(blocked), [])
  assert.doesNotThrow(() => writeGuestProgress(blocked, records))
})
