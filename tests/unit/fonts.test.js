import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DEFAULT_HEBREW_FONT, getHebrewFont, HEBREW_FONTS } from '../../src/fonts.js'

test('font choices use the requested Google Fonts and Varela Round by default', () => {
  assert.deepEqual(HEBREW_FONTS.map(({ name, style }) => [name, style]), [
    ['Playpen Sans Hebrew', 'Script'], ['Varela Round', 'Sans-serif'], ['Frank Ruhl Libre', 'Serif'],
  ])
  assert.equal(getHebrewFont(DEFAULT_HEBREW_FONT).name, 'Varela Round')
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  for (const font of HEBREW_FONTS) {
    assert.equal(getHebrewFont(font.id), font)
    assert.ok(html.includes(`family=${font.name.replaceAll(' ', '+')}`))
    assert.ok(font.family.startsWith(`"${font.name}"`))
  }
  assert.ok(html.includes('display=swap'))
})

test('invalid or stale saved font choices safely use the default', () => {
  for (const value of [null, undefined, '', 'old-font', 'constructor', 'serif; color: red', {}]) {
    assert.equal(getHebrewFont(value).id, DEFAULT_HEBREW_FONT)
  }
})
