export const GUEST_PROGRESS_KEY = 'hebrew-five:guest-progress:v1'

export function isScoredAttempt(attempt) {
  return attempt && typeof attempt.id === 'string' && typeof attempt.sentenceId === 'string'
    && Number.isInteger(attempt.score) && attempt.score >= 0 && attempt.score <= 100
    && attempt.assisted !== true
}

function attemptTime(attempt) {
  if (typeof attempt.createdAt?.toMillis === 'function') return attempt.createdAt.toMillis()
  return Number.isFinite(attempt.completedAt) ? attempt.completedAt : 0
}

export function summarizeAttempts(attempts) {
  const unique = new Map(attempts.filter(isScoredAttempt).map((attempt) => [attempt.id, attempt]))
  let points = 0
  const previousBySentence = new Map()
  for (const attempt of unique.values()) {
    points += attempt.score
    const previous = previousBySentence.get(attempt.sentenceId)
    if (!previous || attemptTime(attempt) > attemptTime(previous)) previousBySentence.set(attempt.sentenceId, attempt)
  }
  return {
    points,
    count: unique.size,
    // Never round an imperfect average up to 100%.
    accuracy: unique.size ? Math.floor(points / unique.size * 10) / 10 : null,
    previousBySentence,
  }
}

export function mergeAttempts(saved, local) {
  const merged = new Map(local.map((attempt) => [attempt.id, attempt]))
  for (const attempt of saved) merged.set(attempt.id, { ...merged.get(attempt.id), ...attempt })
  return [...merged.values()]
}

export function readGuestProgress(storage) {
  try {
    const records = JSON.parse(storage.getItem(GUEST_PROGRESS_KEY) || '[]')
    return Array.isArray(records) ? records.filter(isScoredAttempt) : []
  } catch {
    return []
  }
}

export function writeGuestProgress(storage, attempts) {
  try {
    storage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(attempts))
  } catch {
    // Private browsing or a full quota must not prevent in-memory practice.
  }
}
