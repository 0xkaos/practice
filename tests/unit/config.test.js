import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const configUrl = new URL('../../vite.config.js', import.meta.url).href

function runConfig(env = {}, command = 'build') {
  // An empty env directory verifies CI behavior without reading .env.local or
  // inheriting the developer's unrelated credentials.
  const directory = mkdtempSync(join(tmpdir(), 'phrases-config-'))
  try {
    const script = `import configure from ${JSON.stringify(configUrl)};
      try {
        const config = configure({ command: ${JSON.stringify(command)}, mode: 'production' });
        console.log(JSON.stringify({ define: config.define, base: config.base }));
      } catch (error) { console.log(JSON.stringify({ error: error.message })); }`
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: directory, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8',
    }))
  } finally {
    rmdirSync(directory)
  }
}

test('production configuration fails helpfully when the Pages key is missing', () => {
  assert.match(runConfig().error, /Actions repository secret APIKEY/u)
})

test('only the Firebase browser key is exposed from Actions or Codespaces', () => {
  const actions = runConfig({ VITE_FIREBASE_API_KEY: 'actions-test-key', APIKEY: 'codespaces-test-key', PRIVATE_SECRET: 'never-expose' })
  assert.equal(actions.base, '/')
  assert.deepEqual(actions.define, { 'import.meta.env.VITE_FIREBASE_API_KEY': '"actions-test-key"' })
  assert.deepEqual(runConfig({ APIKEY: 'codespaces-test-key' }).define, { 'import.meta.env.VITE_FIREBASE_API_KEY': '"codespaces-test-key"' })
})

test('unconfigured development still allows guest practice', () => {
  assert.deepEqual(runConfig({}, 'serve').define, { 'import.meta.env.VITE_FIREBASE_API_KEY': '""' })
})
