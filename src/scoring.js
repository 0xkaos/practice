export const GRADING_VERSION = 'ordered-v3'
export const MAX_ANSWER_LENGTH = 500
const REORDERED_SCORE_CAP = 0.67

// English copy/paste artifacts: soft hyphens, zero-width spacing/joiners,
// bidirectional controls and BOM. Keep visible punctuation and accents intact.
const INVISIBLE_FORMATTING = /[\u00AD\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu

// Normalize layout only; case and visible punctuation remain significant.
export function normalizeWhitespace(value) {
  return value.replace(INVISIBLE_FORMATTING, '').trim().replace(/\s+/gu, ' ')
}

function tokenize(text) {
  const pattern = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|[^\s]/gu
  let end = 0
  return [...text.matchAll(pattern)].map((match) => {
    const token = {
      text: match[0],
      leading: text.slice(end, match.index),
      word: /[\p{L}\p{N}]/u.test(match[0]),
    }
    end = match.index + match[0].length
    return token
  })
}

const weight = (token) => token.word ? 1 : 0
const letters = (token) => token.text.replace(/['’]/gu, '')
const comparable = (token) => token.word ? letters(token).toLowerCase() : ''

function replacement(actual, expected) {
  if (!actual.word && !expected.word) return { cost: 0, kind: 'equal' }
  if (actual.word && expected.word && comparable(actual) === comparable(expected)) return { cost: 0, kind: 'equal' }
  return { cost: Math.max(weight(actual), weight(expected)), kind: !actual.word && !expected.word ? 'punctuation' : 'wording' }
}

function compare(answer, reference) {
  const actual = tokenize(answer)
  const expected = tokenize(reference)
  const matrix = Array.from({ length: actual.length + 1 }, () => Array(expected.length + 1))
  matrix[0][0] = { cost: 0 }
  for (let i = 1; i <= actual.length; i++) matrix[i][0] = { cost: matrix[i - 1][0].cost + weight(actual[i - 1]), operation: 'extra' }
  for (let j = 1; j <= expected.length; j++) matrix[0][j] = { cost: matrix[0][j - 1].cost + weight(expected[j - 1]), operation: 'missing' }
  for (let i = 1; i <= actual.length; i++) {
    for (let j = 1; j <= expected.length; j++) {
      const change = replacement(actual[i - 1], expected[j - 1])
      const choices = [
        { cost: matrix[i - 1][j - 1].cost + change.cost, operation: 'pair', kind: change.kind },
        { cost: matrix[i - 1][j].cost + weight(actual[i - 1]), operation: 'extra' },
        { cost: matrix[i][j - 1].cost + weight(expected[j - 1]), operation: 'missing' },
      ]
      matrix[i][j] = choices.reduce((best, next) => next.cost < best.cost - 1e-9 ? next : best)
    }
  }

  const actualParts = []
  const expectedParts = []
  let i = actual.length
  let j = expected.length
  while (i || j) {
    const cell = matrix[i][j]
    if (cell.operation === 'pair') {
      actualParts.unshift({ ...actual[--i], kind: cell.kind })
      expectedParts.unshift({ ...expected[--j], kind: cell.kind })
    } else if (cell.operation === 'extra') {
      actualParts.unshift({ ...actual[--i], kind: 'extra' })
    } else {
      expectedParts.unshift({ ...expected[--j], kind: 'missing' })
    }
  }

  const distance = matrix[actual.length][expected.length].cost
  const denominator = Math.max(actual.reduce((sum, token) => sum + weight(token), 0), expected.reduce((sum, token) => sum + weight(token), 0))
  const exact = distance === 0
  const similarity = answer ? Math.max(0, 1 - distance / denominator) : 0
  return {
    score: exact ? 100 : Math.min(99, Math.round(similarity * 100)),
    exact,
    similarity,
    reference,
    actualParts,
    expectedParts,
  }
}

function compareReordered(answer, reference) {
  const actual = tokenize(answer)
  const expected = tokenize(reference)
  const available = new Map()
  for (const token of expected.filter((token) => token.word)) {
    const key = comparable(token)
    available.set(key, (available.get(key) || 0) + 1)
  }
  let matchedWeight = 0
  const actualParts = actual.map((token) => {
    if (!token.word) return { ...token, kind: 'equal' }
    const key = comparable(token)
    const count = available.get(key) || 0
    if (!count) return { ...token, kind: 'extra' }
    available.set(key, count - 1)
    matchedWeight += weight(token)
    return { ...token, kind: 'equal' }
  })

  const actualAvailable = new Map()
  for (const token of actual.filter((token) => token.word)) {
    const key = comparable(token)
    actualAvailable.set(key, (actualAvailable.get(key) || 0) + 1)
  }
  const expectedParts = expected.map((token) => {
    if (!token.word) return { ...token, kind: 'equal' }
    const key = comparable(token)
    const count = actualAvailable.get(key) || 0
    if (!count) return { ...token, kind: 'missing' }
    actualAvailable.set(key, count - 1)
    return { ...token, kind: 'equal' }
  })

  const denominator = Math.max(actual.reduce((sum, token) => sum + weight(token), 0), expected.reduce((sum, token) => sum + weight(token), 0))
  return {
    score: Math.round(Math.min(REORDERED_SCORE_CAP, matchedWeight / denominator) * 100),
    exact: false,
    similarity: Math.min(REORDERED_SCORE_CAP, matchedWeight / denominator),
    reference,
    actualParts,
    expectedParts,
  }
}

export function scoreTranslation(answer, translations) {
  if (typeof answer !== 'string' || answer.length > MAX_ANSWER_LENGTH) throw new Error('Answer must be at most 500 characters.')
  if (!Array.isArray(translations) || translations.length < 1 || translations.length > 3 || translations.some((text) => typeof text !== 'string' || !normalizeWhitespace(text))) {
    throw new Error('Expected one to three complete canonical translations.')
  }
  const normalized = normalizeWhitespace(answer)
  // Never align against a concatenation or a pool of words from multiple answers.
  return translations.map((text, index) => {
    const reference = normalizeWhitespace(text)
    const ordered = compare(normalized, reference)
    const reordered = compareReordered(normalized, reference)
    return { ...(reordered.similarity > ordered.similarity ? reordered : ordered), referenceIndex: index }
  })
    .reduce((best, result) => result.exact && !best.exact || result.similarity > best.similarity ? result : best)
}
