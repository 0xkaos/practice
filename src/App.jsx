import { useCallback, useEffect, useRef, useState } from 'react'
import sentences from './data/sentences.json'
import { AccountPanel, PracticeHistory, useAccount } from './AccountPanel'
import { GRADING_VERSION, MAX_ANSWER_LENGTH, normalizeWhitespace, scoreTranslation } from './scoring'
import { saveAttempt } from './practice'

const SET_SIZE = 5
const sentencesById = new Map(sentences.map((sentence) => [sentence.id, sentence]))

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

function PlayIcon({ playing }) {
  if (playing) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5.75v12.5M16 5.75v12.5" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="fill" d="m9 6 9 6-9 6V6Z" />
    </svg>
  )
}

function EyeIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.75 12s3.3-5.25 9.25-5.25S21.25 12 21.25 12 17.95 17.25 12 17.25 2.75 12 2.75 12Z" />
      <circle cx="12" cy="12" r="2.4" />
      {open && <path d="m5 4.75 14 14.5" />}
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.4 8.2A8 8 0 1 0 20 14M19.4 8.2V3.9m0 4.3h-4.3" />
    </svg>
  )
}

function AnswerDiff({ parts }) {
  return parts.map((part, index) => (
    <span key={index}>{part.leading}{part.kind === 'equal' ? part.text : <mark title={part.kind}>{part.text}</mark>}</span>
  ))
}

function SentenceCard({ sentence, number, playing, onPlay, user, accountReady, onAttempt, onSaveState }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [everRevealed, setEverRevealed] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingSave, setPendingSave] = useState(null)
  const [saveState, setSaveState] = useState('')
  const saveInFlight = useRef(false)

  const persist = async (submission) => {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setSaveState('saving')
    onSaveState(submission.attempt.id, 'saving')
    try {
      if (!navigator.onLine) throw new Error('Offline')
      await saveAttempt(submission.uid, submission.attempt)
      setSaveState('saved')
      onSaveState(submission.attempt.id, 'saved')
    } catch {
      setSaveState('failed')
      onSaveState(submission.attempt.id, 'failed')
    } finally {
      saveInFlight.current = false
    }
  }

  const check = (event) => {
    event.preventDefault()
    if (result || !answer.trim() || !accountReady) return
    const grade = scoreTranslation(answer, sentence.translations)
    setResult({ ...grade, assisted: everRevealed })
    const attempt = {
      id: crypto.randomUUID(),
      sentenceId: sentence.id,
      answer: normalizeWhitespace(answer),
      score: grade.score,
      exact: grade.exact,
      referenceIndex: grade.referenceIndex,
      assisted: everRevealed,
      translationVersion: sentence.translationVersion,
      gradingVersion: GRADING_VERSION,
    }
    onAttempt(attempt)
    if (user) {
      const submission = { uid: user.uid, attempt }
      setPendingSave(submission)
      void persist(submission)
    } else {
      setSaveState('guest')
    }
  }

  const toggleReveal = () => {
    if (!revealed) setEverRevealed(true)
    setRevealed(!revealed)
  }

  return (
    <article className={`sentence-card${playing ? ' is-playing' : ''}`}>
      <div className="card-topline">
        <span className="card-number" aria-label={`Sentence ${number}`}>
          {String(number).padStart(2, '0')}
        </span>
        <span className="language-mark">עברית</span>
      </div>

      <button
        className="hebrew-line"
        type="button"
        onClick={onPlay}
        aria-label={`Play Hebrew sentence: ${sentence.hebrew}`}
      >
        <span lang="he">{sentence.hebrew}</span>
      </button>

      <div className="card-actions">
        <button className="audio-button" type="button" onClick={onPlay}>
          <PlayIcon playing={playing} />
          <span>{playing ? 'Playing' : 'Listen'}</span>
        </button>
        <button
          className="reveal-button"
          type="button"
          onClick={toggleReveal}
          aria-expanded={revealed}
          aria-controls={`translation-${sentence.id}`}
        >
          <EyeIcon open={revealed} />
          <span>{revealed ? 'Hide translation' : 'Reveal translation'}</span>
        </button>
      </div>

      <form className="answer-form" onSubmit={check} dir="ltr">
        <label htmlFor={`answer-${sentence.id}`}>Your English translation</label>
        <textarea
          id={`answer-${sentence.id}`}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          readOnly={Boolean(result)}
          maxLength={MAX_ANSWER_LENGTH}
          rows={2}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          lang="en"
          dir="ltr"
          placeholder="Write the whole sentence…"
          aria-describedby={`answer-help-${sentence.id}`}
        />
        <div className="answer-actions">
          <span id={`answer-help-${sentence.id}`} className="practice-help">{result ? 'Checked. Start a new set to practice more.' : everRevealed ? 'Translation revealed — this attempt will be marked assisted.' : 'Capitalization and punctuation count.'}</span>
          {!result && <button className="audio-button" type="submit" disabled={!answer.trim() || !accountReady}>Check translation</button>}
        </div>
      </form>

      {result && (
        <div className={`answer-result${result.exact ? ' is-perfect' : ''}`} dir="ltr" role="status">
          <div className="result-topline"><strong>{result.score}% <span>{result.exact ? 'Exact match' : 'Canonical match'}</span></strong><span>{result.assisted ? 'Assisted' : 'Unaided'}</span></div>
          {!result.exact && <><span className="translation-label">YOUR ANSWER · DIFFERENCES HIGHLIGHTED</span><p className="answer-diff"><AnswerDiff parts={result.actualParts} /></p></>}
          <span className="translation-label">{result.exact ? 'ACCEPTED TRANSLATION' : 'CLOSEST ACCEPTED TRANSLATION'}</span>
          <p className="answer-diff"><AnswerDiff parts={result.expectedParts} /></p>
          <p className="save-status">
            {saveState === 'saving' ? 'Saving to your account…' : saveState === 'saved' ? 'Saved to the account used for this attempt.' : saveState === 'guest' ? 'Guest practice — not saved to an account.' : 'Not saved. Check your connection and try again before starting a new set.'}
            {saveState === 'failed' && pendingSave?.uid === user?.uid && <> <button type="button" className="text-button" onClick={() => void persist(pendingSave)}>Retry save</button></>}
            {saveState === 'failed' && pendingSave?.uid !== user?.uid && ' Sign back into the original account to retry.'}
          </p>
        </div>
      )}

      <div id={`translation-${sentence.id}`}>{revealed && <div className="translation is-visible">
        <span className="translation-label">{sentence.translations.length > 1 ? 'ACCEPTED ENGLISH TRANSLATIONS' : 'ENGLISH'}</span>
        {sentence.translations.map((translation) => <p lang="en" dir="ltr" key={translation}>{translation}</p>)}
      </div>}</div>
    </article>
  )
}

export default function App() {
  const [current, setCurrent] = useState(() => shuffledSample(sentences, SET_SIZE))
  const [session, setSession] = useState(0)
  const [attempts, setAttempts] = useState([])
  const [saveStates, setSaveStates] = useState({})
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)
  const account = useAccount()
  const saving = Object.values(saveStates).includes('saving')
  const unsaved = Object.values(saveStates).includes('failed')

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

  const play = useCallback(
    (sentence) => {
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
    },
    [playingId, stopAudio],
  )

  const refresh = () => {
    if (saving || (unsaved && !window.confirm('Some answers have not been saved. Start a new set without saving them?'))) return
    stopAudio()
    setCurrent((previous) =>
      shuffledSample(sentences, SET_SIZE, new Set(previous.map((item) => item.id))),
    )
    setSession((value) => value + 1)
    setAttempts([])
    setSaveStates({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="eyebrow" dir="ltr">
          <span className="eyebrow-dot" />
          SELF PRACTICE · {sentences.length.toLocaleString()} SENTENCES
        </div>
        <div className="hero-heading">
          <div>
            <h1>חמש</h1>
            <p className="hero-hebrew" lang="he">חמישה משפטים. בקצב שלך.</p>
          </div>
          <p className="hero-copy" dir="ltr">
            Listen. Read. Translate.<br />Find your own words first.
          </p>
        </div>
        <div className="hero-rule" />
        <AccountPanel account={account} />
        <p className="practice-help intro-help" dir="ltr">Match an accepted English translation. Scores compare complete sentences, including capitalization and punctuation; other valid wording may score lower. No AI grading.</p>
        {account.user && <PracticeHistory key={account.user.uid} uid={account.user.uid} sentencesById={sentencesById} />}
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
            accountReady={account.ready}
            onAttempt={(attempt) => setAttempts((previous) => [...previous, attempt])}
            onSaveState={(id, state) => setSaveStates((previous) => ({ ...previous, [id]: state }))}
          />
        ))}
      </section>

      <footer className="session-footer">
        <button className="refresh-button" type="button" onClick={refresh} disabled={saving}>
          <RefreshIcon />
          <span>{saving ? 'Saving your answers…' : 'Practice five more'}</span>
        </button>
        <p dir="ltr">{attempts.length ? `${attempts.length}/${SET_SIZE} checked · ${attempts.filter((attempt) => attempt.exact && !attempt.assisted).length} unaided perfect` : `Audio voice: Tamar · Set of ${SET_SIZE}`}</p>
      </footer>
    </main>
  )
}
