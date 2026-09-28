import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, logOut, signIn } from './firebase'

export function useAccount() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!auth)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setReady(true)
      setError('')
    }, () => {
      setReady(true)
      setError('Account access is unavailable. You can still practice without saving.')
    })
  }, [])

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
  return { user, ready, busy, error, available: Boolean(auth), authenticate, logout }
}

export function AccountPanel({ account }) {
  return (
    <div className="account-panel" dir="ltr">
      <div className="account-row">
        <p>{account.user ? <strong>{account.user.displayName || account.user.email || 'Learner'}</strong> : 'Guest session'}</p>
        <button className="reveal-button" type="button" disabled={!account.available || !account.ready || account.busy} onClick={account.user ? account.logout : account.authenticate}>
          {!account.available ? 'Sign-in unavailable' : !account.ready ? 'Connecting…' : account.busy ? 'Please wait…' : account.user ? 'Sign out' : 'Sign in with Google'}
        </button>
      </div>
      {account.error && <p className="error-message" role="alert">{account.error}</p>}
    </div>
  )
}

export function Scoreboard({ progress, signedIn }) {
  const pending = progress.loading || progress.error
  return (
    <section className="scoreboard" aria-label="Practice totals" aria-busy={progress.loading} dir="ltr">
      <span className="score-scope">{signedIn ? 'All time' : 'Session'}</span>
      <dl>
        <div><dt>Points</dt><dd data-testid="points">{pending ? '—' : progress.points.toLocaleString()}</dd></div>
        <div><dt>Accuracy</dt><dd data-testid="accuracy">{pending || progress.accuracy === null ? '—' : `${progress.accuracy}%`}</dd></div>
        <div><dt>Answers</dt><dd data-testid="answers">{pending ? '—' : progress.count.toLocaleString()}</dd></div>
      </dl>
      {progress.error && <p className="error-message" role="alert">Totals unavailable. <button type="button" className="text-button" onClick={progress.retry}>Retry</button></p>}
    </section>
  )
}
