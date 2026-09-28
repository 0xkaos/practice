import { spawnSync } from 'node:child_process'

// Keep unrelated API credentials and inherited DEBUG flags out of Firebase's
// child-process diagnostic output. These tests only use a local demo project.
const environment = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'JAVA_HOME', 'LANG', 'LC_ALL', 'SystemRoot', 'ComSpec']
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
)
environment.FIREBASE_CLI_DISABLE_USAGE_REPORTING = 'true'
const browser = process.argv[2] === 'browser'
const result = spawnSync('firebase', [
  'emulators:exec', '--only', browser ? 'auth,firestore' : 'firestore', '--project', 'demo-phrases',
  browser ? 'playwright test' : 'node --test tests/firestore.rules.test.js',
], { stdio: 'inherit', env: environment })
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
