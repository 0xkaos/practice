import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { scoreTranslation } from '../../src/scoring.js'
import { GUEST_PROGRESS_KEY } from '../../src/progress.js'

const sentences = JSON.parse(readFileSync('src/data/sentences.json', 'utf8'))
const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]))

async function firstSentence(page) {
  const card = page.locator('.sentence-card').first()
  const id = await card.getAttribute('data-sentence-id')
  return { card, sentence: byId.get(id) }
}

async function openPractice(page, deterministic = false) {
  if (deterministic) await page.addInitScript(() => { Math.random = () => 0 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
}

async function answerCard(card, answer) {
  await card.getByRole('button', { name: 'Translate', exact: true }).click()
  await expect(card.getByRole('button', { name: 'Reveal', exact: true })).toBeDisabled()
  await card.getByRole('textbox', { name: 'Your English translation' }).fill(answer)
  await card.getByRole('button', { name: 'Check', exact: true }).click()
}

async function signInTestUser(page, uid) {
  // Firebase Auth emulator only. This SDK credential never reaches production.
  await page.evaluate(async (id) => {
    const { auth } = await import('/src/firebase.js')
    const { GoogleAuthProvider, signInWithCredential } = await import('/node_modules/.vite/deps/firebase_auth.js')
    const token = JSON.stringify({ sub: id, email: `${id}@example.test`, email_verified: true, name: 'Practice Tester', aud: 'test-client', iss: 'https://accounts.google.com', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })
    await signInWithCredential(auth, GoogleAuthProvider.credential(token))
  }, uid)
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Practice totals' })).toHaveAttribute('aria-busy', 'false')
}

test('five compact RTL cards, audio, hidden input, guest totals and new sets', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openPractice(page)
  await expect(page.getByRole('heading', { name: 'חמש', exact: true })).toHaveCount(0)
  await expect(page.locator('.hero-hebrew')).toHaveText('חמישה משפטים. בקצב שלך.')
  await expect(page.locator('.hero-hebrew')).toBeVisible()
  await expect(page.locator('.sentence-card')).toHaveCount(5)
  await expect(page.locator('.sentence-card').getByText('עברית', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByText('Capitalization and punctuation count.')).toHaveCount(0)
  await expect(page.getByTestId('points')).toHaveText('0')
  await expect(page.getByTestId('accuracy')).toHaveText('—')
  expect(await page.locator('.hebrew-line').first().evaluate((element) => getComputedStyle(element).textAlign)).toBe('right')
  expect(await page.locator('.account-panel').evaluate((element) => Boolean(document.querySelector('.session-footer').compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('idle.png'), fullPage: true })
  const { card, sentence } = await firstSentence(page)
  await expect(card.locator('.translation')).toHaveCount(0)
  const audioRequest = page.waitForRequest((request) => request.url().endsWith(`/${sentence.id}.mp3`))
  await card.getByRole('button', { name: 'Listen', exact: true }).click()
  await audioRequest
  await answerCard(card, sentence.english)
  await expect(card.getByRole('status')).toContainText('100%Perfect')
  await expect(card.getByRole('status')).toContainText('+100 points')
  await expect(card.locator('.previous-score')).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Reveal', exact: true })).toBeDisabled()
  await expect(card.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByTestId('points')).toHaveText('100')
  await expect(page.getByTestId('accuracy')).toHaveText('100%')
  await expect(page.getByTestId('answers')).toHaveText('1')
  await page.screenshot({ path: testInfo.outputPath('checked.png'), fullPage: true })
  const previous = await page.locator('.sentence-card').evaluateAll((cards) => cards.map((element) => element.dataset.sentenceId))
  await page.getByRole('button', { name: 'Practice five more' }).click()
  const next = await page.locator('.sentence-card').evaluateAll((cards) => cards.map((element) => element.dataset.sentenceId))
  expect(next.every((id) => !previous.includes(id))).toBe(true)
  await expect(page.locator('.answer-result')).toHaveCount(0)
  await expect(page.getByTestId('points')).toHaveText('100')
  await page.reload()
  await expect(page.getByTestId('points')).toHaveText('100')
  await expect(page.getByTestId('answers')).toHaveText('1')
  expect(errors).toEqual([])
})

test('reveal locks out input even after hiding; revisiting in a later set unlocks it', async ({ page }) => {
  await openPractice(page, true)
  const { card, sentence } = await firstSentence(page)
  await card.getByRole('button', { name: 'Reveal', exact: true }).click()
  await expect(card.locator('.translation')).toContainText(sentence.english)
  await expect(card.getByRole('button', { name: 'Translate', exact: true })).toBeDisabled()
  await card.getByRole('button', { name: 'Hide', exact: true }).click()
  await expect(card.locator('.translation')).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Translate', exact: true })).toBeDisabled()
  await expect(page.locator('.sentence-card').nth(1).getByRole('button', { name: 'Translate', exact: true })).toBeEnabled()
  await expect(page.getByTestId('answers')).toHaveText('0')
  await expect(page.getByTestId('accuracy')).toHaveText('—')
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await page.getByRole('button', { name: 'Practice five more' }).click()
  const revisited = page.locator(`[data-sentence-id="${sentence.id}"]`)
  await expect(revisited.getByRole('button', { name: 'Translate', exact: true })).toBeEnabled()
  await answerCard(revisited, sentence.english)
  await expect(page.getByTestId('points')).toHaveText('100')
})

test('revisited phrases show latest previous score, including zero, without replacing it on check', async ({ page }) => {
  await openPractice(page, true)
  const { card, sentence } = await firstSentence(page)
  await answerCard(card, sentence.english)
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await page.getByRole('button', { name: 'Practice five more' }).click()
  const revisited = page.locator(`[data-sentence-id="${sentence.id}"]`)
  await expect(revisited.locator('.previous-score')).toHaveText('Previous 100%')
  await answerCard(revisited, 'zzzzzz')
  await expect(revisited.getByRole('status')).toContainText('0%')
  await expect(revisited.locator('.previous-score')).toHaveText('Previous 100%')
  await expect(page.getByTestId('points')).toHaveText('100')
  await expect(page.getByTestId('accuracy')).toHaveText('50%')
  await expect(page.getByTestId('answers')).toHaveText('2')
  await page.reload()
  await expect(revisited.locator('.previous-score')).toHaveText('Previous 0%')
  await expect(page.getByTestId('accuracy')).toHaveText('50%')
})

test('case and punctuation still affect the score without instructional text', async ({ page }) => {
  await openPractice(page)
  const { card, sentence } = await firstSentence(page)
  const answer = sentence.english.toLowerCase().replace(/[.!?]$/u, '')
  const expected = scoreTranslation(answer, sentence.translations).score
  expect(expected).toBeLessThan(100)
  await answerCard(card, answer)
  await expect(card.getByRole('status')).toContainText(`${expected}%`)
  await expect(card.locator('mark').first()).toBeVisible()
  await expect(page.getByTestId('points')).toHaveText(String(expected))
  await expect(page.getByTestId('accuracy')).toHaveText(`${expected}%`)
})

test('invisible clipboard characters earn full points and are removed from saved guest answers', async ({ page }) => {
  await openPractice(page)
  const { card, sentence } = await firstSentence(page)
  const pasted = `\u200F${sentence.english.replace(' ', ' \u200B\u200B')}\u2060`
  await answerCard(card, pasted)
  await expect(card.getByRole('status')).toContainText('100%Perfect')
  await expect(card.locator('mark')).toHaveCount(0)
  await expect(page.getByTestId('points')).toHaveText('100')
  await expect(page.getByTestId('accuracy')).toHaveText('100%')
  const saved = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), GUEST_PROGRESS_KEY)
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ answer: sentence.english, score: 100, exact: true })
  await page.reload()
  await expect(page.getByTestId('points')).toHaveText('100')
})

test('invisible-only input cannot submit or consume the attempt', async ({ page }) => {
  await openPractice(page)
  const { card, sentence } = await firstSentence(page)
  await card.getByRole('button', { name: 'Translate', exact: true }).click()
  await card.getByRole('textbox').fill('\u200B\u200F \u2060')
  await expect(card.getByRole('button', { name: 'Check', exact: true })).toBeDisabled()
  // The submit handler must also reject invisible-only input independently of
  // the disabled button (e.g. a programmatic or keyboard form submission).
  await card.locator('form').evaluate((form) => form.requestSubmit())
  await expect(card.getByRole('status')).toHaveCount(0)
  await expect(page.getByTestId('answers')).toHaveText('0')
  await card.getByRole('textbox').fill(sentence.english)
  await card.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByTestId('points')).toHaveText('100')
  await expect(page.getByTestId('answers')).toHaveText('1')
})

test('guest scoring still works when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage unavailable') } }))
  await openPractice(page)
  const { card, sentence } = await firstSentence(page)
  await answerCard(card, sentence.english)
  await expect(page.getByTestId('points')).toHaveText('100')
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await expect(page.getByTestId('points')).toHaveText('100')
})

test('saved totals persist; guests and different accounts stay separate', async ({ page, browser }) => {
  await openPractice(page)
  const { card, sentence } = await firstSentence(page)
  const guestAnswer = sentence.english.toLowerCase().replace(/[.!?]$/u, '')
  const guestScore = scoreTranslation(guestAnswer, sentence.translations).score
  await answerCard(card, guestAnswer)
  const uid = `practice-${crypto.randomUUID()}`
  await signInTestUser(page, uid)
  await expect(page.getByTestId('points')).toHaveText('0')
  // A mode choice stays locked even across account changes within this set.
  await expect(card.getByRole('button', { name: 'Reveal', exact: true })).toBeDisabled()
  const second = page.locator('.sentence-card').nth(1)
  const secondSentence = byId.get(await second.getAttribute('data-sentence-id'))
  await answerCard(second, secondSentence.english)
  await expect(second.locator('.save-status')).toHaveText('Saved', { timeout: 15000 })
  await expect(page.getByTestId('points')).toHaveText('100')
  await page.reload()
  await expect(page.getByTestId('points')).toHaveText('100')
  await expect(page.getByTestId('answers')).toHaveText('1')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByTestId('points')).toHaveText(String(guestScore))
  await expect(page.getByTestId('answers')).toHaveText('1')
  await signInTestUser(page, `other-${crypto.randomUUID()}`)
  await expect(page.getByTestId('points')).toHaveText('0')
  await expect(page.getByTestId('answers')).toHaveText('0')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await signInTestUser(page, uid)
  await expect(page.getByTestId('points')).toHaveText('100')
  // A fresh browser session must not inherit the first guest's progress.
  const fresh = await browser.newContext()
  const freshPage = await fresh.newPage()
  await freshPage.goto('http://127.0.0.1:4173/')
  await expect(freshPage.getByTestId('points')).toHaveText('0')
  await expect(freshPage.getByTestId('answers')).toHaveText('0')
  await fresh.close()
})

test('all-time totals include older history and latest saved score appears on the phrase', async ({ page }) => {
  await openPractice(page, true)
  await signInTestUser(page, `all-time-${crypto.randomUUID()}`)
  const { card, sentence } = await firstSentence(page)
  await page.evaluate(async (phrase) => {
    const { auth } = await import('/src/firebase.js')
    const { saveAttempt } = await import('/src/practice.js')
    for (let index = 0; index < 25; index += 1) {
      const score = index === 24 ? 32 : 100
      await saveAttempt(auth.currentUser.uid, {
        id: crypto.randomUUID(), sentenceId: phrase.id, answer: phrase.english,
        score, exact: score === 100, referenceIndex: 0, assisted: false,
        translationVersion: phrase.translationVersion, gradingVersion: 'ordered-v2',
      })
    }
  }, sentence)
  await expect(page.getByTestId('points')).toHaveText('2,432')
  await expect(page.getByTestId('answers')).toHaveText('25')
  await expect(page.getByTestId('accuracy')).toHaveText('97.2%')
  await expect(card.locator('.previous-score')).toHaveText('Previous 32%')
  await answerCard(card, sentence.english)
  await expect(card.locator('.save-status')).toHaveText('Saved', { timeout: 15000 })
  await expect(card.locator('.previous-score')).toHaveText('Previous 32%')
  await expect(page.getByTestId('points')).toHaveText('2,532')
  await page.reload()
  await expect(page.getByTestId('answers')).toHaveText('26')
  await expect(page.getByTestId('points')).toHaveText('2,532')
  await expect(card.locator('.previous-score')).toHaveText('Previous 100%')
})

test('offline answers can be retried once without duplication or silent loss', async ({ page, context }) => {
  await openPractice(page)
  await signInTestUser(page, `offline-${crypto.randomUUID()}`)
  const { card, sentence } = await firstSentence(page)
  await context.setOffline(true)
  await answerCard(card, sentence.english)
  await expect(card.getByRole('status')).toContainText('Not saved.')
  await expect(page.getByTestId('points')).toHaveText('100')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await expect(card.getByRole('status')).toContainText('Not saved.')
  await context.setOffline(false)
  await card.getByRole('button', { name: 'Retry save' }).click()
  await expect(card.locator('.save-status')).toHaveText('Saved', { timeout: 15000 })
  await page.reload()
  await expect(page.getByTestId('points')).toHaveText('100')
  await expect(page.getByTestId('answers')).toHaveText('1')
})

test('discarding a failed save removes it from account totals', async ({ page, context }) => {
  await openPractice(page)
  await signInTestUser(page, `discard-${crypto.randomUUID()}`)
  const { card, sentence } = await firstSentence(page)
  await context.setOffline(true)
  await answerCard(card, sentence.english)
  await expect(card.getByRole('status')).toContainText('Not saved.')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await expect(page.getByTestId('points')).toHaveText('0')
  await expect(page.getByTestId('answers')).toHaveText('0')
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByTestId('answers')).toHaveText('0')
})
