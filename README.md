# Vocab Core

Search journal articles by a word or topic, open an abstract, and learn the 20%
of words that cover most of it, with Vietnamese, Chinese and English meanings
in context.

## Run

```bash
npm install
cp .env.example .env      # keys are optional, see below
npm run dev               # API on :8787, web app on :5173
```

Production: `npm run build`, then `npm start` (one server for both API and app).
`npm test` checks the text pipeline and the search-result handling.

## Keys

| Key | Needed for | Without it |
|---|---|---|
| `OPENALEX_API_KEY` (free, openalex.org/settings/api) | Better search | Search uses Crossref, no key needed |
| `ANTHROPIC_API_KEY` (paid by usage) | In-context translations | Search and word analysis still work |

## Your own API (`server/`)

- `GET /api/search?q=word`: journal articles with abstracts, ranked by match
- `POST /api/claude`: forwards to Anthropic with the key added server-side

`server/index.js` holds the routes; `server/sources.js` talks to OpenAlex and
Crossref and converts both to one result shape.

## Front end (`src/`)

- `lib/pipeline.js`: the five steps and the coverage maths (`franc-min`, `stopword`, `stemmer`, `Intl.Segmenter`)
- `lib/claude.js`: glossary calls
- `App.jsx`: the interface
# learning_english
