import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const sentences = JSON.parse(readFileSync('src/data/sentences.json', 'utf8'))
const byId = new Map(sentences.map((sentence) => [sentence.id, sentence]))

async function firstSentence(page) {
  const card = page.locator('.sentence-card').first()
  const id = (await card.locator('textarea').getAttribute('id')).replace('answer-', '')
  return { card, sentence: byId.get(id) }
}

test('five RTL Hebrew cards, audio, strict scoring, no pre-answer hints, and new set', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  await expect(page.locator('.sentence-card')).toHaveCount(5)
  expect(await page.locator('.hebrew-line').first().evaluate((element) => getComputedStyle(element).textAlign)).toBe('right')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const { card, sentence } = await firstSentence(page)
  await expect(card.locator('.translation')).toHaveCount(0)
  const audioRequest = page.waitForRequest((request) => request.url().endsWith(`/${sentence.id}.mp3`))
  await card.getByRole('button', { name: 'Listen', exact: true }).click()
  await audioRequest
  await card.locator('textarea').fill(sentence.english)
  await card.getByRole('button', { name: 'Check translation' }).click()
  await expect(card.getByRole('status')).toContainText('100% Exact match')
  await expect(card.getByRole('status')).toContainText('Unaided')
  await expect(card.getByRole('status')).toContainText('not saved to an account')
  await page.screenshot({ path: testInfo.outputPath('checked.png'), fullPage: true })
  await card.getByRole('button', { name: 'Reveal translation' }).click()
  await expect(card.getByRole('status')).toContainText('Unaided')
  const previous = await page.locator('.sentence-card textarea').evaluateAll((inputs) => inputs.map((input) => input.id))
  await page.getByRole('button', { name: 'Practice five more' }).click()
  const next = await page.locator('.sentence-card textarea').evaluateAll((inputs) => inputs.map((input) => input.id))
  expect(next.every((id) => !previous.includes(id))).toBe(true)
  await expect(page.locator('.answer-result')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('reveal is sticky for assistance and case/punctuation prevent a perfect score', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  const { card, sentence } = await firstSentence(page)
  await card.getByRole('button', { name: 'Reveal translation' }).click()
  await card.getByRole('button', { name: 'Hide translation' }).click()
  await card.locator('textarea').fill(sentence.english.toLowerCase().replace(/[.!?]$/u, ''))
  await card.getByRole('button', { name: 'Check translation' }).click()
  await expect(card.getByRole('status')).toContainText('Assisted')
  await expect(card.getByRole('status')).not.toContainText('100%')
  await expect(card.locator('mark').first()).toBeVisible()
})

async function signInTestUser(page, uid) {
  // Firebase Auth emulator only. This SDK credential never reaches production.
  await page.evaluate(async (id) => {
    const { auth } = await import('/src/firebase.js')
    const { GoogleAuthProvider, signInWithCredential } = await import('/node_modules/.vite/deps/firebase_auth.js')
    const token = JSON.stringify({ sub: id, email: `${id}@example.test`, email_verified: true, name: 'Practice Tester', aud: 'test-client', iss: 'https://accounts.google.com', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })
    await signInWithCredential(auth, GoogleAuthProvider.credential(token))
  }, uid)
}

test('authenticated results persist across reload; sign-out clears account history', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  await signInTestUser(page, `practice-${Date.now()}`)
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  const { card, sentence } = await firstSentence(page)
  await card.locator('textarea').fill(sentence.english)
  await card.getByRole('button', { name: 'Check translation' }).click()
  await expect(card.getByRole('status')).toContainText('Saved to the account', { timeout: 15000 })
  await page.reload()
  await page.locator('.practice-history summary').click()
  await expect(page.locator('.history-list li')).toHaveCount(1)
  await expect(page.locator('.history-list')).toContainText(sentence.english)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.locator('.practice-history')).toHaveCount(0)
  await signInTestUser(page, `other-${Date.now()}`)
  await page.locator('.practice-history summary').click()
  await expect(page.locator('.practice-history')).toContainText('No saved answers yet.')
})

test('offline answers can be retried once without duplication or silent loss', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  await signInTestUser(page, `offline-${Date.now()}`)
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  const { card, sentence } = await firstSentence(page)
  await context.setOffline(true)
  await card.locator('textarea').fill(sentence.english)
  await card.getByRole('button', { name: 'Check translation' }).click()
  await expect(card.getByRole('status')).toContainText('Not saved.')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await expect(card.getByRole('status')).toContainText('Not saved.')
  await context.setOffline(false)
  await card.getByRole('button', { name: 'Retry save' }).click()
  await expect(card.getByRole('status')).toContainText('Saved to the account', { timeout: 15000 })
  await page.reload()
  await page.locator('.practice-history summary').click()
  await expect(page.locator('.history-list li')).toHaveCount(1)
  await expect(page.locator('.history-list')).toContainText(sentence.english)
})
