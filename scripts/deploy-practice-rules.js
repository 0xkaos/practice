// Default is read-only. --apply publishes only the managed practice block,
// merged into the CURRENT live rules, not the repository's emulator snapshot.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergePracticeRules } from './merge-practice-rules.js'

const project = 'alephbetical-11f49'
const releaseName = `projects/${project}/releases/cloud.firestore`
const require = createRequire(import.meta.url)
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const cliAuth = require(join(globalModules, 'firebase-tools/lib/auth.js'))
const account = cliAuth.getGlobalDefaultAccount()
if (!account) throw new Error('Run firebase login first.')
const token = await cliAuth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'])

async function api(path, method = 'GET', data) {
  const response = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    ...(data ? { body: JSON.stringify(data) } : {}),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`Rules API ${response.status}: ${body.error?.message || 'request failed'}`)
  return body
}

const release = await api(releaseName)
const live = await api(release.rulesetName)
if (live.source.files.length !== 1) throw new Error('Multi-file live rules require a manual merge.')
const fragment = readFileSync(new URL('../firebase/practice.rules.fragment', import.meta.url), 'utf8')
const original = live.source.files[0]
const merged = mergePracticeRules(original.content, fragment)
console.log(`Project: ${project}\nPrevious ruleset (rollback target): ${release.rulesetName}`)
if (merged === original.content) {
  console.log('Practice rules are already current; nothing to publish.')
} else if (!process.argv.includes('--apply')) {
  console.log('Dry run: current live rules can be preserved while adding/updating only the practice block. Pass --apply after testing.')
} else {
  const files = [{ ...original, content: merged }]
  const check = await api(`projects/${project}:test`, 'POST', { source: { files } })
  if (check.issues?.some((issue) => issue.severity === 'ERROR')) throw new Error(`Rule validation failed: ${JSON.stringify(check.issues)}`)
  const ruleset = await api(`projects/${project}/rulesets`, 'POST', { source: { files } })
  const latest = await api(releaseName)
  if (latest.rulesetName !== release.rulesetName) throw new Error('Live rules changed during validation. Nothing was released; rerun to merge the new version.')
  await api(releaseName, 'PATCH', { release: { name: releaseName, rulesetName: ruleset.name } })
  const published = await api(releaseName)
  if (published.rulesetName !== ruleset.name) throw new Error('Published ruleset verification failed.')
  console.log(`Published and verified: ${ruleset.name}\nExisting rules outside the practice block were preserved byte-for-byte.`)
}
