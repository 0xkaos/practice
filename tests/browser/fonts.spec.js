import { expect, test } from '@playwright/test'
import { DEFAULT_HEBREW_FONT, HEBREW_FONTS, HEBREW_FONT_KEY } from '../../src/fonts.js'

async function openPractice(page) {
  await page.goto('/')
  await expect(page.locator('.sentence-card')).toHaveCount(5)
  return page.getByRole('combobox', { name: 'Hebrew font', exact: true })
}

test('bottom selector changes only Hebrew, preserving the current set and draft', async ({ page }, testInfo) => {
  const selector = await openPractice(page)
  await expect(selector).toHaveValue(DEFAULT_HEBREW_FONT)
  await expect(selector.locator('option')).toHaveText(HEBREW_FONTS.map((font) => `${font.style} — ${font.name}`))
  expect(await page.locator('.font-settings').evaluate((element) => Boolean(document.querySelector('.account-panel').compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  const cards = page.locator('.sentence-card')
  const ids = await cards.evaluateAll((elements) => elements.map((element) => element.dataset.sentenceId))
  const first = cards.first()
  await first.getByRole('button', { name: 'Reveal', exact: true }).click()
  const second = cards.nth(1)
  await second.getByRole('button', { name: 'Translate', exact: true }).click()
  await second.getByRole('textbox').fill('Keep this draft.')
  const englishFont = await first.locator('.translation p').first().evaluate((element) => getComputedStyle(element).fontFamily)
  const controlFont = await first.locator('.audio-button').evaluate((element) => getComputedStyle(element).fontFamily)
  for (const font of HEBREW_FONTS) {
    await selector.selectOption(font.id)
    for (const target of ['.hebrew-line', '.hero-hebrew']) {
      await expect(page.locator(target).first()).toHaveCSS('font-family', font.family)
    }
    await expect(first.locator('.hebrew-line')).toHaveCSS('font-weight', String(font.weight))
    await expect(first.locator('.translation p').first()).toHaveCSS('font-family', englishFont)
    await expect(first.locator('.audio-button')).toHaveCSS('font-family', controlFont)
    await expect(second.getByRole('textbox')).toHaveValue('Keep this draft.')
    await expect(first.getByRole('button', { name: 'Translate', exact: true })).toBeDisabled()
    await expect(page.getByTestId('answers')).toHaveText('0')
    expect(await cards.evaluateAll((elements) => elements.map((element) => element.dataset.sentenceId))).toEqual(ids)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`${font.id}.png`), fullPage: true })
  }
})

test('font preference survives new sets, reloads and tabs; invalid values fall back', async ({ page, context }) => {
  const selector = await openPractice(page)
  await selector.selectOption('script')
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await expect(selector).toHaveValue('script')
  await page.reload()
  await expect(selector).toHaveValue('script')
  const another = await context.newPage()
  const anotherSelector = await openPractice(another)
  await expect(anotherSelector).toHaveValue('script')
  await another.close()
  await page.evaluate((key) => localStorage.setItem(key, 'no-longer-supported'), HEBREW_FONT_KEY)
  await page.reload()
  await expect(selector).toHaveValue(DEFAULT_HEBREW_FONT)
})

test('font switching still works when local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked') } }))
  const selector = await openPractice(page)
  await expect(selector).toHaveValue(DEFAULT_HEBREW_FONT)
  await selector.selectOption('serif')
  await expect(selector).toHaveValue('serif')
  await expect(page.locator('.hebrew-line').first()).toHaveCSS('font-family', HEBREW_FONTS.find((font) => font.id === 'serif').family)
  await page.getByRole('button', { name: 'Practice five more' }).click()
  await expect(selector).toHaveValue('serif')
})

test('blocked Google Fonts does not prevent reading or practicing', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  const selector = await openPractice(page)
  for (const font of HEBREW_FONTS) {
    await selector.selectOption(font.id)
    await expect(page.locator('.hebrew-line').first()).toBeVisible()
  }
  const card = page.locator('.sentence-card').first()
  await card.getByRole('button', { name: 'Translate', exact: true }).click()
  await card.getByRole('textbox').fill('An answer.')
  await card.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(card.getByRole('status')).toBeVisible()
  await expect(page.getByTestId('answers')).toHaveText('1')
  expect(errors).toEqual([])
})
