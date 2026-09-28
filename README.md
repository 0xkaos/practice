# חמש — Hebrew sentence practice

A lightweight Hebrew-first practice app built from 1,085 Tatoeba sentences and locally generated Tamar voice recordings.

Type a complete English translation, check it locally, and see the closest accepted answer with differences highlighted. Google sign-in uses the existing `alephbetical-11f49` Firebase project. Signed-in answers are saved to Firestore; guest practice remains available without an account. There are no AI grading APIs or model downloads.

## Local development

```bash
npm ci
npm run dev
```

Open the URL Vite prints. The app is served from the site root to support its custom domain.

## Dataset updates

All 1,085 source pairs have been reviewed. 52 sentences have exactly one alternative; 1,033 have one accepted answer. 46 canonical English translations have corrections recorded separately from the original data.

- `hebrew_sentences_with_audio.csv`: original source, including licensed remote audio links; unchanged.
- `data/translation-review.json`: curated overrides, alternatives, reasons, review version, and original CSV fingerprint.
- `data/translation-review.csv`: generated, readable audit of **every** sentence, including decisions to keep the existing single answer.
- `src/data/sentences.json`: generated browser data. Do not edit it directly.

Alternatives are whole, independently accepted sentences, not interchangeable word banks. Routine synonyms, contractions, and spelling variants are deliberately not generated. The sentence אני תוהה אם יירד גשם מחר retains only “I wonder if it will rain tomorrow.”

The browser-ready index and audit report are generated with:

```bash
npm run data
```

Each production build refreshes the index automatically. Audio files live in `narakeet_audio/` and are copied into the static build by Vite.

If the source CSV changes, review the changed data before updating `sourceSha256` and `reviewedSentenceCount`. A mismatched fingerprint stops the build. A new canonical/scoring version also needs the corresponding permitted version in the practice rules.

## Scoring

`src/scoring.js` compares an answer against each accepted translation separately using weighted, ordered token edit distance, and chooses the best complete match. Word insertion, deletion, or substitution costs 1; capitalization-only changes cost 0.2 per word; punctuation changes cost 0.15. Order matters. Only surrounding/repeated whitespace is normalized; apostrophes, quote styles, capitalization, and punctuation remain significant. Non-exact results are capped at 99%, even if rounding would otherwise give 100%.

These are **canonical text-match scores**, not semantic judgments. An unlisted but valid paraphrase can score lower, and a meaning-changing word may still leave a high partial text match. No alternative's words are pooled with another's.

An answer is checked once per card/set. Revealing a translation before checking permanently marks that attempt assisted, even if hidden again. Revealing it after checking does not change its status. Assisted results are saved but excluded from the recent-history average.

## Firebase

The public web-app configuration is in `src/firebase.js`; it is not a private API credential. Authentication is Google sign-in, using the existing Firebase account pool. `phrases.alephbetical.com` is authorized. The frontend stays on GitHub Pages.

Results live only under `phrasePractice/{uid}/attempts/{attemptId}`. Owner-only rules validate their shape and permit creation, reading and deletion, but not editing submitted attempts. No AI app collections, user profiles, storage, or existing Cloud Functions are written by this app. Client-side scoring is appropriate for personal practice, **not a tamper-proof competitive leaderboard**.

The history displays the latest 20 saved attempts and their unaided average, not an all-time total. Guest answers are not uploaded retroactively after sign-in. Failed saves remain retryable while the set is open; retries use the same document ID and cannot double-count an attempt. The app warns before abandoning failed saves and waits for active saves before starting another set.

### Shared-project rule deployment

Do **not** blindly deploy the emulator rules snapshot over the shared project's live rules. Use the additive deployment script, which fetches the current live rules, replaces only the marked practice block, validates, checks for concurrent changes, and prints the previous ruleset ID for rollback:

```bash
node scripts/deploy-practice-rules.js          # read-only preview
node scripts/deploy-practice-rules.js --apply  # publish the scoped change
```

Requires a globally installed, authenticated Firebase CLI. The managed fragment is `firebase/practice.rules.fragment`. `firebase/firestore.rules` is the full snapshot used by the emulator tests. **Future deployments from the AI application's repository must also retain the practice block**, or saving here will stop working. Likewise, this repository's script preserves new AI-app rules when merging.

## Verification

```bash
npm run data
npm test
npm run test:rules
npx playwright install chromium
npm run test:browser
npm run build
```

Emulator tests require Java 21 and the Firebase CLI. They use only the `demo-phrases` project with Firestore on `127.0.0.1:18080` and Auth on `127.0.0.1:19099`. The wrapper excludes unrelated environment credentials and debug flags. No real test accounts or attempts are created. Browser tests cover desktop and mobile layouts, audio requests, exact/partial scoring, assisted attempts, save/reload, and account isolation. Google OAuth itself should also be smoke-tested on the deployed domain after pushing.

## Deployment

Push `main` to deploy through GitHub Actions. In the repository settings, choose **Settings → Pages → Build and deployment → GitHub Actions** as the publishing source.

The site is available at <https://phrases.alephbetical.com/>.
