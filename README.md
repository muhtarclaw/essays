# Idris — Essays

A small, modern site for short essays. Static, dependency-free, hosted on GitHub Pages.

🔗 **https://github.com/muhtarclaw/essays**

## Stack

- **HTML, CSS, vanilla JS** — no framework, no bundler
- **Markdown essays** with front matter (title, slug, date, tags, excerpt)
- **Fraunces + Inter** via Google Fonts
- **Light/dark theme** with system preference + localStorage
- **RSS feed** auto-generated at build time

## Layout

```
.
├── index.html          # essay list
├── about.html
├── 404.html
├── assets/
│   ├── style.css
│   ├── main.js         # theme toggle
│   └── essays.js       # list + markdown renderer
├── essays/
│   ├── *.md            # essays (front matter + body)
│   ├── post.html       # essay detail (uses ?slug=...)
│   └── essays.json     # generated
├── scripts/
│   └── build.mjs       # builds essays.json + feed.xml
├── feed.xml            # generated
└── .github/workflows/
    └── pages.yml       # GitHub Pages deploy
```

## Adding an essay

1. Drop a new `essays/your-slug.md` with front matter:

   ```markdown
   ---
   slug: your-slug
   title: Your Title
   date: 2026-08-17
   tags: [writing, software]
   excerpt: One-sentence summary used on the index and in the RSS feed.
   ---

   Body in markdown.
   ```

2. Run `node scripts/build.mjs` to regenerate `essays/essays.json` and `feed.xml`.
3. Commit. If Pages is set up, GitHub Actions will deploy.

## Local preview

```bash
node scripts/build.mjs
python3 -m http.server 8766 --bind 127.0.0.1
# open http://127.0.0.1:8766/
```

## Publishing

### Manual (works with any token)

The site is fully static — you can publish it without GitHub Actions:

1. Settings → Pages → **Source: Deploy from a branch**
2. Pick `main` / `/ (root)`
3. Save. Pages will serve `index.html` at `https://muhtarclaw.github.io/essays/`

### With GitHub Actions (recommended)

The repo includes `.github/workflows/pages.yml`. To enable it, the push needs a token with the `workflow` scope. Steps:

1. Locally: `git add .github/workflows/pages.yml && git commit -m "ci: add Pages workflow" && git push`
   (Requires a PAT with `workflow` scope, since GitHub blocks workflow file pushes otherwise.)
2. Settings → Pages → **Source: GitHub Actions**
3. The included workflow builds `essays/essays.json` + `feed.xml` on every push to `main`, then deploys.

## Customising

- **Site URL**: set `SITE_URL` env var when running the build for canonical RSS links.
- **Theme defaults**: edit `--bg`, `--fg`, `--accent` in `assets/style.css`.
- **Typography**: swap fonts in the `<link>` tags of each HTML file.