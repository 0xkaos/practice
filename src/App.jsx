import { useCallback, useEffect, useRef, useState } from 'react'
import sentences from './data/sentences.json'
import { AccountPanel, Scoreboard, useAccount } from './AccountPanel'
import SentenceCard from './SentenceCard'
import { useProgress } from './useProgress'
import FontSelector from './FontSelector'
import { DEFAULT_HEBREW_FONT, getHebrewFont, HEBREW_FONT_KEY } from './fonts'

const SET_SIZE = 5

function shuffledSample(items, count, excludedIds = new Set()) {
  const preferred = items.filter((item) => !excludedIds.has(item.id))
  const pool = preferred.length >= count ? preferred : items
  const copy = [...pool]

  for (let index = copy.length - 1; index > copy.length - 1 - count; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]]
  }

  return copy.slice(-count)
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 8.2A8 8 0 1 0 20 14M19.4 8.2V3.9m0 4.3h-4.3" /></svg>
}

export default function App() {
  const [current, setCurrent] = useState(() => shuffledSample(sentences, SET_SIZE))
  const [session, setSession] = useState(0)
  const [attempts, setAttempts] = useState([])
  const [saveStates, setSaveStates] = useState({})
  const [playingId, setPlayingId] = useState(null)
  const [hebrewFont, setHebrewFont] = useState(() => {
    try { return getHebrewFont(window.localStorage.getItem(HEBREW_FONT_KEY)).id }
    catch { return DEFAULT_HEBREW_FONT }
  })
  const font = getHebrewFont(hebrewFont)
  const audioRef = useRef(null)
  const account = useAccount()
  const progress = useProgress(account.user)
  const saving = Object.values(saveStates).includes('saving')
  const unsaved = Object.values(saveStates).includes('failed')

  useEffect(() => {
    try { window.localStorage.setItem(HEBREW_FONT_KEY, hebrewFont) }
    catch { /* Font switching still works when browser storage is blocked. */ }
  }, [hebrewFont])

  useEffect(() => {
    if (!saving && !unsaved) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saving, unsaved])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlayingId(null)
  }, [])

  useEffect(() => stopAudio, [stopAudio])

  const play = useCallback((sentence) => {
    if (playingId === sentence.id) {
      stopAudio()
      return
    }
    stopAudio()
    const audio = new Audio(`${import.meta.env.BASE_URL}${sentence.id}.mp3`)
    audioRef.current = audio
    audio.addEventListener('ended', () => setPlayingId(null), { once: true })
    audio.addEventListener('error', () => setPlayingId(null), { once: true })
    setPlayingId(sentence.id)
    audio.play().catch(() => setPlayingId(null))
  }, [playingId, stopAudio])

  const refresh = () => {
    if (saving || (unsaved && !window.confirm('Some answers have not been saved. Start a new set without saving them?'))) return
    progress.discardUnsaved(Object.keys(saveStates).filter((id) => saveStates[id] === 'failed'))
    stopAudio()
    setCurrent((previous) => shuffledSample(sentences, SET_SIZE, new Set(previous.map((item) => item.id))))
    setSession((value) => value + 1)
    setAttempts([])
    setSaveStates({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="app-shell" style={{ '--hebrew-font': font.family, '--hebrew-weight': font.weight }}>
      <header className="hero">
        <div className="eyebrow" dir="ltr">
          <span className="eyebrow-dot" />
          SELF PRACTICE · {sentences.length.toLocaleString()} SENTENCES
        </div>
        <p className="hero-hebrew" lang="he">חמישה משפטים. בקצב שלך.</p>
        <div className="hero-rule" />
        <Scoreboard progress={progress} signedIn={Boolean(account.user)} />
      </header>

      <section className="practice-list" aria-label="Five Hebrew practice sentences">
        {current.map((sentence, index) => (
          <SentenceCard
            key={`${session}-${sentence.id}`}
            sentence={sentence}
            number={index + 1}
            playing={playingId === sentence.id}
            onPlay={() => play(sentence)}
            user={account.user}
            accountReady={account.ready && !progress.loading}
            previousAttempt={progress.previousBySentence.get(sentence.id)}
            onAttempt={(attempt, uid) => {
              setAttempts((previous) => [...previous, attempt])
              progress.record(attempt, uid)
            }}
            onSaveState={(id, state) => setSaveStates((previous) => ({ ...previous, [id]: state }))}
          />
        ))}
      </section>

      <section className="session-refresh" aria-label="New practice set">
        <button className="refresh-button" type="button" onClick={refresh} disabled={saving}>
          <RefreshIcon /><span>{saving ? 'Saving…' : 'Practice five more'}</span>
        </button>
      </section>

      <footer className="session-footer">
        <div className="footer-controls">
          <AccountPanel account={account} />
          <FontSelector value={hebrewFont} onChange={setHebrewFont} />
        </div>
        <small className="attribution" dir="ltr">
          Phrases from <a href="https://tatoeba.org">Tatoeba</a> · Audio generated by{' '}
          <a href="https://www.narakeet.com">Narakeet</a>
        </small>
      </footer>
    </main>
  )
}
