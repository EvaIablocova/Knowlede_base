# Knowledge Base — Book Notes & Mind Maps

A static web app for collecting book highlights and creating mind maps. Hosted on Vercel.

## Features

- **Book library** — add books with colored covers, store highlights and notes per book
- **Mind maps** — create and view mind maps linked to books
- **Data sync** — on every page load, the latest data is fetched from a JSON file in this GitHub repo
- **Export / Import** — download or upload your data as JSON

## How data works

The site fetches `knowledge_base_backup_2026-01-31.json` from this repo on every visit (via `raw.githubusercontent.com`). This is the single source of truth.

**To update the content:**

1. Edit or replace `knowledge_base_backup_2026-01-31.json` in this repo
2. Commit and push to `main`
3. All visitors will see the updated data on their next page load

## Project structure

```
index.html                              — main HTML page
css/style.css                           — styles
js/
  storage.js                            — data layer (localStorage + GitHub fetch)
  books.js                              — book library UI
  mindmap.js                            — mind map UI
knowledge_base_backup_2026-01-31.json   — default data file
vercel.json                             — Vercel config (SPA rewrites)
```

## Running locally

Open `index.html` in a browser. No build step required.

## Deployment

Deployed on Vercel. Pushes to `main` trigger automatic redeployment.
