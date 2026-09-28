import { useCallback, useEffect, useMemo, useState } from 'react'
import { watchAttempts } from './practice'
import { mergeAttempts, readGuestProgress, summarizeAttempts, writeGuestProgress } from './progress'

export function useProgress(user) {
  const uid = user?.uid || null
  const [guest, setGuest] = useState(() => {
    try { return readGuestProgress(window.sessionStorage) } catch { return [] }
  })
  const [localByUser, setLocalByUser] = useState({})
  const [remote, setRemote] = useState({ uid: null, attempts: [], loading: false, error: false })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    try { writeGuestProgress(window.sessionStorage, guest) } catch { /* Storage unavailable. */ }
  }, [guest])

  useEffect(() => {
    if (!uid) return
    let active = true
    setRemote({ uid, attempts: [], loading: true, error: false })
    const unsubscribe = watchAttempts(uid, (attempts) => {
      if (active) setRemote({ uid, attempts, loading: false, error: false })
    }, () => {
      if (active) setRemote({ uid, attempts: [], loading: false, error: true })
    })
    return () => { active = false; unsubscribe() }
  }, [uid, retry])

  const record = useCallback((attempt, ownerUid) => {
    const entry = { ...attempt, completedAt: Date.now() }
    if (ownerUid) {
      setLocalByUser((previous) => ({ ...previous, [ownerUid]: [...(previous[ownerUid] || []), entry] }))
    } else {
      setGuest((previous) => [...previous, entry])
    }
  }, [])

  const discardUnsaved = useCallback((ids) => {
    const removed = new Set(ids)
    setLocalByUser((previous) => Object.fromEntries(Object.entries(previous).map(([owner, records]) => [owner, records.filter((record) => !removed.has(record.id))])))
  }, [])

  const attempts = useMemo(() => uid
    ? mergeAttempts(remote.uid === uid ? remote.attempts : [], localByUser[uid] || [])
    : guest, [uid, remote, localByUser, guest])
  const summary = useMemo(() => summarizeAttempts(attempts), [attempts])

  return {
    ...summary,
    loading: Boolean(uid && (remote.uid !== uid || remote.loading)),
    error: Boolean(uid && remote.uid === uid && remote.error),
    retry: () => setRetry((value) => value + 1),
    record,
    discardUnsaved,
  }
}
