import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, logOut, signIn } from './firebase'
import { watchAttempts } from './practice'

export function useAccount() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next)
    setReady(true)
    setError('')
  }, () => {
    setReady(true)
    setError('Account access is unavailable. You can still practice without saving.')
  }), [])

  const authenticate = async () => {
    setBusy(true)
    setError('')
    try {
      await signIn()
    } catch (failure) {
      if (failure.code !== 'auth/popup-closed-by-user' && failure.code !== 'auth/cancelled-popup-request') {
        setError(failure.code === 'auth/popup-blocked'
          ? 'Allow pop-ups for this site, then try signing in again.'
          : failure.code === 'auth/unauthorized-domain'
            ? 'This domain must be authorized in Firebase Authentication.'
            : 'Sign-in failed. Please try again. You can still practice without signing in.')
      }
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await logOut()
    } catch {
      setError('Sign-out failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return { user, ready, busy, error, authenticate, logout }
}

export function AccountPanel({ account }) {
  return (
    <div className="account-panel" dir="ltr">
      <div className="account-row">
        <p>{account.user ? <>Signed in as <strong>{account.user.displayName || account.user.email || 'learner'}</strong></> : 'Practice freely. Sign in to save your next answers.'}</p>
        <button className="reveal-button" type="button" disabled={!account.ready || account.busy} onClick={account.user ? account.logout : account.authenticate}>
          {!account.ready ? 'Checking account…' : account.busy ? 'Please wait…' : account.user ? 'Sign out' : 'Sign in with Google'}
        </button>
      </div>
      {account.error && <p className="error-message" role="alert">{account.error}</p>}
    </div>
  )
}

export function PracticeHistory({ uid, sentencesById }) {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    setAttempts([])
    setLoading(true)
    setError(false)
    return watchAttempts(uid, (results) => { setAttempts(results); setLoading(false) }, () => { setError(true); setLoading(false) })
  }, [uid, retry])
  const unaided = attempts.filter((attempt) => !attempt.assisted)
  const average = unaided.length ? Math.floor(unaided.reduce((sum, attempt) => sum + attempt.score, 0) / unaided.length) : null
  return (
    <details className="practice-history" dir="ltr">
      <summary>Saved practice <span>{loading ? 'Loading…' : error ? 'Unavailable' : `${attempts.length} recent answers${average === null ? '' : ` · ${average}% unaided average`}`}</span></summary>
      {error ? <p role="alert">Couldn’t load saved results. <button type="button" className="text-button" onClick={() => setRetry((value) => value + 1)}>Try again</button></p>
        : loading ? <p>Loading your saved answers…</p>
          : attempts.length === 0 ? <p>No saved answers yet. Check a translation below to save your first result.</p>
            : <>
              <p className="practice-help">Your latest 20 answers. Revealed/assisted answers are excluded from the average. Scores measure canonical wording, not every possible valid translation.</p>
              <ol className="history-list">
                {attempts.map((attempt) => (
                  <li key={attempt.id}>
                    <div className="history-topline"><span>{attempt.createdAt?.toDate().toLocaleString() || 'Just now'}</span><strong>{attempt.score}%{attempt.assisted ? ' · assisted' : ''}</strong></div>
                    <p className="history-hebrew" lang="he" dir="rtl">{sentencesById.get(attempt.sentenceId)?.hebrew || `Sentence ${attempt.sentenceId}`}</p>
                    <p>{attempt.answer}</p>
                  </li>
                ))}
              </ol>
            </>}
    </details>
  )
}
