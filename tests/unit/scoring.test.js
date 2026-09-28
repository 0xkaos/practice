import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { normalizeWhitespace, scoreTranslation } from '../../src/scoring.js'

const alternatives = ["I'm not in the mood to go out today.", "I don't feel like going out today."]

test('each whole canonical answer gets 100, independently', () => {
  alternatives.forEach((answer, index) => {
    const result = scoreTranslation(answer, alternatives)
    assert.equal(result.score, 100)
    assert.equal(result.exact, true)
    assert.equal(result.referenceIndex, index)
  })
})

test('does not combine fragments of alternatives into a perfect answer', () => {
  for (const answer of ["I don't mood like going out today.", "I'm not feel like going out today.", alternatives.join(' ')]) {
    const result = scoreTranslation(answer, alternatives)
    assert.equal(result.exact, false)
    assert.ok(result.score < 100)
    assert.equal(result.score, Math.max(...alternatives.map((reference) => scoreTranslation(answer, [reference]).score)))
  }
})

test('capitalization and punctuation are ignored', () => {
  for (const answer of ["i don't feel like going out today.", "I don't feel like going out today", "I don't feel like going out today!", 'I don’t feel like going out today.', 'I dont feel like going out today.']) {
    const result = scoreTranslation(answer, alternatives)
    assert.equal(result.score, 100)
    assert.equal(result.exact, true)
  }
})

test('missing, extra, substituted, and reordered words receive partial credit', () => {
  for (const answer of ["I feel like going out today.", "I don't really feel like going out today.", "Today out going like feel don't I."]) {
    const result = scoreTranslation(answer, alternatives)
    assert.ok(result.score > 0 && result.score < 100)
  }
})

test('reordered matching words receive capped credit and remain highlighted accurately', () => {
  const result = scoreTranslation('Bill and I are good friends.', ['I am good friends with Bill.'])
  assert.equal(result.score, 67)
  assert.equal(result.exact, false)
  assert.equal(result.actualParts.find((part) => part.text === 'Bill').kind, 'equal')
  assert.equal(result.actualParts.find((part) => part.text === 'good').kind, 'equal')
  assert.equal(result.actualParts.find((part) => part.text === 'friends').kind, 'equal')
  assert.equal(result.actualParts.find((part) => part.text === 'and').kind, 'extra')
  assert.equal(result.expectedParts.find((part) => part.text === 'with').kind, 'missing')
})

test('whitespace is normalized; blank and unrelated answers do not pass', () => {
  assert.equal(scoreTranslation('  I  don\'t feel like going out today.  ', alternatives).score, 100)
  assert.equal(scoreTranslation('   ', alternatives).score, 0)
  assert.equal(scoreTranslation('purple', alternatives).score, 0)
  assert.throws(() => scoreTranslation('x'.repeat(501), alternatives))
  assert.throws(() => scoreTranslation('hello', []))
})

test('invisible zero-width spaces in the reported Canada answer do not cost points', () => {
  const reference = 'What languages are spoken in Canada?'
  const pasted = 'What languages \u200B\u200Bare spoken in Canada?'
  for (const [answer, expected] of [[pasted, reference], [reference, pasted]]) {
    const result = scoreTranslation(answer, [expected])
    assert.equal(result.score, 100)
    assert.equal(result.exact, true)
    assert.equal(result.reference, reference)
    assert.ok(result.actualParts.every((part) => part.kind === 'equal'))
    assert.equal(normalizeWhitespace(answer), reference)
  }
})

test('invisible clipboard formatting is removed before trimming and tokenization', () => {
  const reference = 'What languages are spoken in Canada?'
  const formatting = [0x00AD, 0x061C, 0x200B, 0x200C, 0x200D, 0x200E, 0x200F,
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069, 0xFEFF]
  for (const codePoint of formatting) {
    const marker = String.fromCodePoint(codePoint)
    const pasted = `${marker}  What lan${marker}guages ${marker}are spoken in Canada?  ${marker}`
    assert.equal(normalizeWhitespace(pasted), reference, `U+${codePoint.toString(16)}`)
    assert.equal(scoreTranslation(pasted, [reference]).score, 100)
  }
})

test('invisible formatting cannot mask visible spelling differences', () => {
  const reference = 'What languages are spoken in Canada?'
  for (const answer of ['What language are spoken in Canada?',
    'What languagés are spoken in Canada?']) {
    const plain = scoreTranslation(answer, [reference])
    assert.ok(plain.score < 100)
    assert.equal(scoreTranslation(`\u200F${answer}\u200B`, [reference]).score, plain.score)
  }
})

test('invisible-only input stays blank and cannot be a canonical reference', () => {
  const blank = '\u200F \u200B\u200B\u2060 \uFEFF'
  assert.equal(normalizeWhitespace(blank), '')
  const result = scoreTranslation(blank, alternatives)
  assert.equal(result.score, 0)
  assert.equal(result.exact, false)
  assert.deepEqual(result.actualParts, [])
  assert.throws(() => scoreTranslation(blank, [blank]), /canonical translations/u)
})

test('alignment reconstructs both texts, preserving punctuation and case', () => {
  const answer = "i don't mood like going out today!"
  const result = scoreTranslation(answer, alternatives)
  const join = (parts) => parts.map((part) => part.leading + part.text).join('')
  assert.equal(join(result.actualParts), answer)
  assert.equal(join(result.expectedParts), result.reference)
  assert.ok(result.actualParts.some((part) => part.kind === 'wording'))
  assert.ok(scoreTranslation("I don't really feel like going out today.", alternatives).actualParts.some((part) => part.kind === 'extra'))
})

test('punctuation-only differences earn a perfect score', () => {
  const reference = `${'word '.repeat(90)}end.`
  assert.equal(scoreTranslation(reference.slice(0, -1), [reference]).score, 100)
})

test('apostrophe positions are ignored', () => {
  assert.equal(scoreTranslation("d'ont", ["do'nt"]).score, 100)
})

test('an exact later alternative wins', () => {
  assert.equal(scoreTranslation('right', ['wrong', 'right']).referenceIndex, 1)
})

const sentences = JSON.parse(readFileSync(new URL('../../src/data/sentences.json', import.meta.url)))
const review = JSON.parse(readFileSync(new URL('../../data/translation-review.json', import.meta.url)))

test('entire reviewed dataset is fingerprinted and has 1–3 distinct whole answers', () => {
  assert.equal(sentences.length, 1085)
  assert.equal(review.reviewedSentenceCount, sentences.length)
  assert.equal(new Set(sentences.map((s) => s.id)).size, sentences.length)
  const sourceHash = createHash('sha256').update(readFileSync(new URL('../../hebrew_sentences_with_audio.csv', import.meta.url))).digest('hex')
  assert.equal(sourceHash, review.sourceSha256)
  for (const sentence of sentences) {
    assert.ok(sentence.translations.length >= 1 && sentence.translations.length <= 3)
    assert.equal(new Set(sentence.translations).size, sentence.translations.length)
    assert.equal(sentence.english, sentence.translations[0])
    for (const translation of sentence.translations) assert.equal(scoreTranslation(translation, sentence.translations).score, 100)
  }
})

test('alternatives are sparse and the user’s straightforward example stays single', () => {
  assert.equal(sentences.filter((sentence) => sentence.translations.length > 1).length, 52)
  assert.deepEqual(sentences.find((sentence) => sentence.id === '556413').translations, ['I wonder if it will rain tomorrow.'])
  assert.equal(sentences.find((sentence) => sentence.id === '565197').english, 'Two plus two equals four.')
  assert.equal(sentences.find((sentence) => sentence.id === '575954').english, 'I want to be alone.')
})
