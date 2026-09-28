import { useRef, useState } from 'react'
import { GRADING_VERSION, MAX_ANSWER_LENGTH, normalizeWhitespace, scoreTranslation } from './scoring'
import { saveAttempt } from './practice'

function PlayIcon({ playing }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{playing
    ? <path d="M8 5.75v12.5M16 5.75v12.5" />
    : <path className="fill" d="m9 6 9 6-9 6V6Z" />}</svg>
}

function WriteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5ZM12 20h8" /></svg>
}

function EyeIcon({ open }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.75 12s3.3-5.25 9.25-5.25S21.25 12 21.25 12 17.95 17.25 12 17.25 2.75 12 2.75 12Z" /><circle cx="12" cy="12" r="2.4" />{open && <path d="m5 4.75 14 14.5" />}</svg>
}

function AnswerDiff({ parts }) {
  return parts.map((part, index) => <span key={index}>{part.leading}{part.kind === 'equal' ? part.text : <mark title={part.kind}>{part.text}</mark>}</span>)
}

export default function SentenceCard({ sentence, number, playing, onPlay, user, accountReady, previousAttempt, onAttempt, onSaveState }) {
  const [mode, setMode] = useState('idle')
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingSave, setPendingSave] = useState(null)
  const [saveState, setSaveState] = useState('')
  const saveInFlight = useRef(false)
  const checked = useRef(false)
  const previousScore = result ? result.previousScore : previousAttempt?.score

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
    if (mode !== 'translate' || checked.current || !answer.trim() || !accountReady) return
    checked.current = true
    const grade = scoreTranslation(answer, sentence.translations)
    setResult({ ...grade, previousScore: previousAttempt?.score })
    const attempt = {
      id: crypto.randomUUID(),
      sentenceId: sentence.id,
      answer: normalizeWhitespace(answer),
      score: grade.score,
      exact: grade.exact,
      referenceIndex: grade.referenceIndex,
      assisted: false,
      translationVersion: sentence.translationVersion,
      gradingVersion: GRADING_VERSION,
    }
    const uid = user?.uid || null
    onAttempt(attempt, uid)
    if (uid) {
      const submission = { uid, attempt }
      setPendingSave(submission)
      void persist(submission)
    } else {
      setSaveState('guest')
    }
  }

  const chooseReveal = () => {
    if (mode === 'translate') return
    setMode('reveal')
    setRevealed((visible) => !visible)
  }

  return (
    <article className={`sentence-card${playing ? ' is-playing' : ''}`} data-sentence-id={sentence.id}>
      <div className="card-topline">
        <span className="card-number" aria-label={`Sentence ${number}`}>{String(number).padStart(2, '0')}</span>
        {Number.isFinite(previousScore) && <span className="previous-score" dir="ltr">Previous {previousScore}%</span>}
        <span className="language-mark">עברית</span>
      </div>

      <button className="hebrew-line" type="button" onClick={onPlay} aria-label={`Play Hebrew sentence: ${sentence.hebrew}`}>
        <span lang="he">{sentence.hebrew}</span>
      </button>

      <div className="card-actions">
        <button className="audio-button" type="button" onClick={onPlay}><PlayIcon playing={playing} /><span>{playing ? 'Playing' : 'Listen'}</span></button>
        <div className="translation-options" role="group" aria-label="Translation options">
          <button className="choice-button" type="button" onClick={() => { if (mode === 'idle') setMode('translate') }} disabled={mode !== 'idle'} aria-pressed={mode === 'translate'} aria-expanded={mode === 'translate' && !result} aria-controls={`answer-panel-${sentence.id}`}>
            <WriteIcon /><span>Translate</span>
          </button>
          <button className="choice-button" type="button" onClick={chooseReveal} disabled={mode === 'translate'} aria-pressed={mode === 'reveal'} aria-expanded={revealed} aria-controls={`translation-${sentence.id}`}>
            <EyeIcon open={revealed} /><span>{revealed ? 'Hide' : 'Reveal'}</span>
          </button>
        </div>
      </div>

      <div id={`answer-panel-${sentence.id}`}>
        {mode === 'translate' && !result && <form className="answer-form" onSubmit={check} dir="ltr">
          <label htmlFor={`answer-${sentence.id}`} className="sr-only">Your English translation</label>
          <textarea id={`answer-${sentence.id}`} value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={MAX_ANSWER_LENGTH} rows={2} spellCheck={false} autoCorrect="off" autoCapitalize="off" autoFocus lang="en" dir="ltr" placeholder="Your translation…" />
          <div className="answer-actions"><button className="audio-button" type="submit" disabled={!answer.trim() || !accountReady}>Check</button></div>
        </form>}
      </div>

      {result && <div className={`answer-result${result.exact ? ' is-perfect' : ''}`} dir="ltr" role="status">
        <div className="result-topline"><strong>{result.score}%{result.exact && <span>Perfect</span>}</strong><span>+{result.score} points</span></div>
        {!result.exact && <><span className="translation-label">YOUR ANSWER</span><p className="answer-diff"><AnswerDiff parts={result.actualParts} /></p></>}
        <span className="translation-label">{result.exact ? 'TRANSLATION' : 'CLOSEST MATCH'}</span>
        <p className="answer-diff"><AnswerDiff parts={result.expectedParts} /></p>
        {saveState !== 'guest' && <p className="save-status">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Not saved.'}
          {saveState === 'failed' && pendingSave?.uid === user?.uid && <> <button type="button" className="text-button" onClick={() => void persist(pendingSave)}>Retry save</button></>}
          {saveState === 'failed' && pendingSave?.uid !== user?.uid && ' Original account required.'}
        </p>}
      </div>}

      <div id={`translation-${sentence.id}`}>{revealed && <div className="translation is-visible">
        {sentence.translations.map((translation) => <p lang="en" dir="ltr" key={translation}>{translation}</p>)}
      </div>}</div>
    </article>
  )
}
