# חמש — Hebrew sentence practice

A lightweight Hebrew-first practice app built from 1,085 Tatoeba sentences and locally generated Tamar voice recordings.

## Local development

```bash
npm ci
npm run dev
```

Open the URL Vite prints. The app is configured under the `/practice/` base path to match GitHub Pages.

## Dataset updates

The browser-ready index is generated from `hebrew_sentences_with_audio.csv`:

```bash
npm run data
```

Each production build refreshes the index automatically. Audio files live in `narakeet_audio/` and are copied into the static build by Vite.

## Deployment

Push `main` to deploy through GitHub Actions. In the repository settings, choose **Settings → Pages → Build and deployment → GitHub Actions** as the publishing source.

The site will be available at <https://0xkaos.github.io/practice/>.
