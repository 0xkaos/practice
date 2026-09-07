import { useCallback, useEffect, useRef, useState } from 'react'
import sentences from './data/sentences.json'

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

function SentenceCard({ sentence, number, revealed, playing, onReveal, onPlay }) {
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
          onClick={onReveal}
          aria-expanded={revealed}
          aria-controls={`translation-${sentence.id}`}
        >
          <EyeIcon open={revealed} />
          <span>{revealed ? 'Hide translation' : 'Reveal translation'}</span>
        </button>
      </div>

      <div
        className={`translation${revealed ? ' is-visible' : ''}`}
        id={`translation-${sentence.id}`}
        aria-hidden={!revealed}
      >
        <span className="translation-label">ENGLISH</span>
        <p lang="en" dir="ltr">{sentence.english}</p>
      </div>
    </article>
  )
}

export default function App() {
  const [current, setCurrent] = useState(() => shuffledSample(sentences, SET_SIZE))
  const [revealed, setRevealed] = useState(() => new Set())
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

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

  const toggleTranslation = (id) => {
    setRevealed((visible) => {
      const next = new Set(visible)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const refresh = () => {
    stopAudio()
    setCurrent((previous) =>
      shuffledSample(sentences, SET_SIZE, new Set(previous.map((item) => item.id))),
    )
    setRevealed(new Set())
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
            Listen first. Read closely.<br />Reveal when you’re ready.
          </p>
        </div>
        <div className="hero-rule" />
      </header>

      <section className="practice-list" aria-label="Five Hebrew practice sentences">
        {current.map((sentence, index) => (
          <SentenceCard
            key={sentence.id}
            sentence={sentence}
            number={index + 1}
            revealed={revealed.has(sentence.id)}
            playing={playingId === sentence.id}
            onReveal={() => toggleTranslation(sentence.id)}
            onPlay={() => play(sentence)}
          />
        ))}
      </section>

      <footer className="session-footer">
        <button className="refresh-button" type="button" onClick={refresh}>
          <RefreshIcon />
          <span>Practice five more</span>
        </button>
        <p dir="ltr">Audio voice: Tamar · Set of {SET_SIZE}</p>
      </footer>
    </main>
  )
}
