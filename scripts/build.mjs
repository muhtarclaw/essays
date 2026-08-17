#!/usr/bin/env node
// Build site: regenerate essays.json + feed.xml + per-essay HTML pages.
// All styling is INLINE on individual elements — no external CSS, no <style>
// blocks (just a tiny reset). Works in any browser, including stripped-down
// in-app previews.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ESSAYS_DIR = path.join(ROOT, 'essays');
const OUT_JSON = path.join(ESSAYS_DIR, 'essays.json');
const OUT_FEED = path.join(ROOT, 'feed.xml');
const POST_TEMPLATE = path.join(ESSAYS_DIR, 'post.template.html');
const INDEX_PATH = path.join(ROOT, 'index.html');
const ABOUT_PATH = path.join(ROOT, 'about.html');
const NOTFOUND_PATH = path.join(ROOT, '404.html');
const SITE_URL = process.env.SITE_URL || 'https://muhtarclaw.github.io/essays/';
const SITE_TITLE = 'Essays';
const SITE_DESC = 'Short essays on software, language, and the small things.';

// Shared inline styles
const RESET_STYLE = `*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body, h1, h2, h3, h4, p, ul, ol, figure, blockquote, pre, hr { margin: 0; }
ul, ol { padding: 0; list-style: none; }
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
:root { color-scheme: light dark; }`;

// Dark theme overrides — only the tokens differ. Most elements use CSS
// variables so they swap automatically. The small handful of inline colors
// that don't use variables (e.g. SVG strokes, hardcoded code accent) are
// flipped here.
const DARK_OVERRIDES = `[data-theme="dark"] {
  body { background:#0f0f0e !important; color:#f0efea !important; }
  header { background:#0f0f0e !important; border-bottom-color:#2a2a28 !important; }
  header a { color:#f0efea !important; }
  header nav a { color:#a9a8a3 !important; }
  main { background:#0f0f0e; }
  footer { background:#0f0f0e !important; border-top-color:#2a2a28 !important; color:#6a6a66 !important; }
  footer a { color:#a9a8a3 !important; }
  .essay-card { border-color:transparent; }
  .essay-card:hover { background:#18181a !important; border-color:#2a2a28 !important; }
  .essay-card h2 { color:#f0efea !important; }
  .essay-card p { color:#a9a8a3 !important; }
  .essay-card .essay-meta { color:#6a6a66 !important; }
  .essay-card .essay-meta .dot { background:#6a6a66 !important; }
  .essay-card .essay-tag { background:#20201e !important; color:#a9a8a3 !important; border-color:#2a2a28 !important; }
  .post-header { border-bottom-color:#2a2a28 !important; }
  .post-header h1 { color:#f0efea !important; }
  .post-meta { color:#6a6a66 !important; }
  .post-meta .dot { background:#6a6a66 !important; }
  .post-content p { color:#f0efea !important; }
  .post-content li { color:#f0efea !important; }
  .post-content a { color:#fb923c !important; border-bottom-color:rgba(251,146,60,0.35) !important; }
  .post-content blockquote { color:#a9a8a3 !important; }
  .post-content code { background:#1c1c1a !important; color:#fb923c !important; }
  .post-content pre { background:#1c1c1a !important; border-color:#2a2a28 !important; }
  .post-content pre code { color:#f0efea !important; }
  .post-content hr { border-top-color:#2a2a28 !important; }
  .post-nav { border-top-color:#2a2a28 !important; }
  .post-nav a { background:#18181a !important; border-color:#2a2a28 !important; color:#f0efea !important; }
  .post-nav .label { color:#6a6a66 !important; }
  .about-content p { color:#f0efea !important; }
  .lede { color:#a9a8a3 !important; }
  .eyebrow { background:#2a1810 !important; color:#fb923c !important; }
  h1 { color:#f0efea !important; }
  .brand { color:#f0efea !important; }
  .brand-mark { color:#fb923c !important; }
  .theme-toggle { border-color:#2a2a28 !important; color:#a9a8a3 !important; }
}`;

const BODY_STYLE = `margin:0;font-family:Georgia,'Times New Roman',serif;background:#f7f5f0;color:#1a1a1a;line-height:1.7;-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column;`;

const SANS_STYLE = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`;

const WRAP_STYLE = `max-width:720px;margin:0 auto;padding:0 24px;width:100%;`;

const HEADER_STYLE = `border-bottom:1px solid #e3e0d6;background:#f7f5f0;position:sticky;top:0;z-index:50;`;
const HEADER_WRAP_STYLE = `${WRAP_STYLE}padding-top:18px;padding-bottom:18px;display:flex;align-items:center;justify-content:space-between;`;
const BRAND_STYLE = `display:inline-flex;align-items:baseline;gap:8px;font-weight:600;font-size:22px;letter-spacing:-0.02em;color:#1a1a1a;`;
const BRAND_MARK_STYLE = `color:#c2410c;font-weight:700;`;
const NAV_STYLE = `display:flex;align-items:center;gap:24px;font-size:15px;${SANS_STYLE}`;
const NAV_LINK_STYLE = `color:#4a4a48;font-weight:500;`;

const MAIN_STYLE = `flex:1;padding:80px 24px 96px;`;

const HERO_STYLE = `margin-bottom:80px;`;
const EYEBROW_STYLE = `display:inline-block;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c2410c;margin-bottom:18px;font-weight:600;padding:4px 12px;background:#fce8db;border-radius:999px;${SANS_STYLE}`;
const H1_STYLE = `font-size:48px;font-weight:600;letter-spacing:-0.03em;line-height:1.08;margin-bottom:20px;color:#1a1a1a;`;
const LEDE_STYLE = `color:#4a4a48;font-size:19px;max-width:560px;line-height:1.55;${SANS_STYLE}`;

const ESSAYS_LIST_STYLE = `display:flex;flex-direction:column;`;
const CARD_STYLE = `display:block;padding:28px;margin:0 -28px;border-radius:12px;border:1px solid transparent;transition:background-color .2s ease,border-color .2s ease,transform .2s ease;`;
const CARD_META_STYLE = `display:flex;gap:10px;align-items:center;font-size:13px;color:#8a8a86;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;font-weight:500;${SANS_STYLE}`;
const CARD_DOT_STYLE = `width:3px;height:3px;background:#8a8a86;border-radius:50%;display:inline-block;`;
const CARD_H2_STYLE = `font-size:28px;font-weight:600;letter-spacing:-0.025em;line-height:1.2;margin-bottom:10px;color:#1a1a1a;`;
const CARD_P_STYLE = `color:#4a4a48;font-size:16px;max-width:580px;line-height:1.55;margin-top:6px;${SANS_STYLE}`;
const CARD_TAGS_STYLE = `display:flex;gap:6px;margin-top:14px;flex-wrap:wrap;`;
const CARD_TAG_STYLE = `font-size:12px;padding:3px 10px;border-radius:999px;background:#efece4;color:#4a4a48;font-weight:500;border:1px solid #e3e0d6;${SANS_STYLE}`;

const FOOTER_STYLE = `border-top:1px solid #e3e0d6;padding:32px 24px;color:#8a8a86;font-size:14px;${SANS_STYLE}`;
const FOOTER_WRAP_STYLE = `max-width:720px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;`;
const FOOTER_LINK_STYLE = `color:#4a4a48;`;

const POST_HEADER_STYLE = `margin-bottom:48px;padding-bottom:24px;border-bottom:1px solid #e3e0d6;`;
const POST_H1_STYLE = `font-size:46px;font-weight:600;letter-spacing:-0.03em;line-height:1.1;margin-bottom:16px;color:#1a1a1a;`;
const POST_META_STYLE = `color:#8a8a86;font-size:14px;display:flex;gap:10px;align-items:center;text-transform:uppercase;letter-spacing:0.06em;font-weight:500;${SANS_STYLE}`;

const CONTENT_STYLE = `font-size:18px;line-height:1.78;${SANS_STYLE}`;
const CONTENT_H2_STYLE = `font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:600;letter-spacing:-0.022em;margin-top:2.2em;line-height:1.2;`;
const CONTENT_H3_STYLE = `font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:600;letter-spacing:-0.015em;margin-top:1.7em;`;
const CONTENT_P_STYLE = `color:#1a1a1a;margin-top:1.3em;`;
const CONTENT_A_STYLE = `color:#c2410c;border-bottom:1.5px solid rgba(194,65,12,0.35);`;
const CONTENT_LI_STYLE = `color:#1a1a1a;margin-top:0.5em;`;
const CONTENT_UL_STYLE = `padding-left:1.6em;margin-top:1.3em;`;
const CONTENT_OL_STYLE = `padding-left:1.6em;margin-top:1.3em;`;
const CONTENT_BQ_STYLE = `border-left:3px solid #c2410c;padding:4px 0 4px 24px;font-style:italic;color:#4a4a48;font-family:Georgia,'Times New Roman',serif;font-size:19px;margin-top:1.3em;`;
const CONTENT_CODE_STYLE = `font-family:'SF Mono',Menlo,Consolas,monospace;font-size:0.86em;background:#f3f1ea;padding:2px 7px;border-radius:4px;color:#c2410c;font-weight:500;`;
const CONTENT_PRE_STYLE = `font-family:'SF Mono',Menlo,Consolas,monospace;background:#f3f1ea;padding:18px 22px;border-radius:12px;overflow-x:auto;font-size:14px;line-height:1.6;border:1px solid #e3e0d6;margin-top:1.3em;`;
const CONTENT_HR_STYLE = `border:none;border-top:1px solid #e3e0d6;margin:2.5em auto;width:60px;`;

// Mobile overrides (window.innerWidth <= 600) — applied via inline mediaQuery
const MOBILE_BODY = `@media (max-width:600px) {
  body { font-size:16px; }
  main { padding-top:48px !important; padding-bottom:64px !important; }
  section[style*="margin-bottom:80px"] { margin-bottom:48px !important; }
  .essay-card { padding:22px 20px !important; margin:0 -20px !important; }
  .essay-card h2 { font-size:22px !important; }
  h1 { font-size:36px !important; }
  .post-nav { grid-template-columns:1fr !important; }
  .post-nav a.next { text-align:left !important; align-items:flex-start !important; }
  header > div { padding-top:14px !important; padding-bottom:14px !important; }
  .brand { font-size:19px !important; }
  nav { gap:16px !important; }
  .post-content h1 { font-size:32px !important; }
}`;

function parseFrontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Missing front matter');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fm[key] = val;
  }
  return { meta: fm, body: m[2] };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeXml(s) {
  return s.replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;'
  }[c]));
}

function renderInline(s) {
  s = escapeHtml(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code style="${CONTENT_CODE_STYLE}">${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    const safe = /^(https?:\/\/|mailto:|\/|#)/.test(u) ? u : '#';
    const ext = /^https?:/.test(safe);
    return `<a href="${escapeHtml(safe)}" style="${CONTENT_A_STYLE}"${ext ? ' rel="noopener"' : ''}>${escapeHtml(t)}</a>`;
  });
  return s;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const L = lines[i];
    if (!L.trim()) { i++; continue; }
    if (/^---+$/.test(L.trim())) { out.push(`<hr style="${CONTENT_HR_STYLE}"/>`); i++; continue; }
    const h = L.match(/^(#{1,4})\s+(.+)/);
    if (h) {
      const style = h[1].length === 2 ? CONTENT_H2_STYLE : h[1].length === 3 ? CONTENT_H3_STYLE : `font-size:22px;font-weight:600;margin-top:1.5em;`;
      out.push(`<h${h[1].length} style="${style}">${renderInline(h[2])}</h${h[1].length}>`);
      i++; continue;
    }
    if (L.startsWith('```')) {
      const lang = L.slice(3).trim(); i++;
      const buf = [];
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      const langAttr = lang ? ` class="lang-${escapeHtml(lang)}"` : '';
      out.push(`<pre style="${CONTENT_PRE_STYLE}"><code${langAttr}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (L.startsWith('> ')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote style="${CONTENT_BQ_STYLE}">${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(L)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(`<li style="${CONTENT_LI_STYLE}">${renderInline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul style="${CONTENT_UL_STYLE}">${buf.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(L)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(`<li style="${CONTENT_LI_STYLE}">${renderInline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol style="${CONTENT_OL_STYLE}">${buf.join('')}</ol>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() &&
      !/^(#{1,4}\s|>|```|[-*]\s|\d+\.\s|---+$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p style="${CONTENT_P_STYLE}">${renderInline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return iso; }
}

function readingTime(md) {
  const words = (md.match(/\b\w+\b/g) || []).length;
  return `${Math.max(1, Math.round(words / 220))} min read`;
}

function renderCard(e) {
  const tags = (e.tags && e.tags.length)
    ? `<div style="${CARD_TAGS_STYLE}">${e.tags.map(t => `<span class="essay-tag" style="${CARD_TAG_STYLE}">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';
  return `
      <a class="essay-card" href="/essays/${e.slug}/" style="${CARD_STYLE}">
        <div class="essay-meta" style="${CARD_META_STYLE}">
          <time datetime="${escapeHtml(e.date)}">${escapeHtml(formatDate(e.date))}</time>
          <span style="${CARD_DOT_STYLE}"></span>
          <span>${escapeHtml(readingTime(e.body || ''))}</span>
        </div>
        <h2 style="${CARD_H2_STYLE}">${escapeHtml(e.title)}</h2>
        <p style="${CARD_P_STYLE}">${escapeHtml(e.excerpt || '')}</p>
        ${tags}
      </a>`;
}

function sharedHeader() {
  return `
  <header style="${HEADER_STYLE}">
    <div style="${HEADER_WRAP_STYLE}">
      <a class="brand" href="/" style="${BRAND_STYLE}">
        <span class="brand-mark" style="${BRAND_MARK_STYLE}">e.</span>
        <span>Essays</span>
      </a>
      <nav style="${NAV_STYLE}">
        <a href="/" style="${NAV_LINK_STYLE}">Essays</a>
        <a href="/about.html" style="${NAV_LINK_STYLE}">About</a>
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle theme" style="background:transparent;border:1px solid #e3e0d6;width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#4a4a48;padding:0;">
          <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </nav>
    </div>
  </header>`;
}

function sharedFooter() {
  return `
  <footer style="${FOOTER_STYLE}">
    <div style="${FOOTER_WRAP_STYLE}">
      <p style="margin:0;">© <span id="year"></span> · <a href="/feed.xml" style="${FOOTER_LINK_STYLE}">RSS</a></p>
    </div>
  </footer>`;
}

function pageHead(title, description) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <style>${RESET_STYLE}
${DARK_OVERRIDES}
${MOBILE_BODY}</style>
  <link rel="alternate" type="application/rss+xml" title="Essays" href="/feed.xml" />
  <script>
    // Apply theme as early as possible to avoid flash
    (function() {
      var s = localStorage.getItem('essays-theme');
      var p = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', s || p);
    })();
  </script>
</head>
<body style="${BODY_STYLE}">`;
}

function pageTail() {
  return `
  <script src="/assets/main.js"></script>
</body>
</html>`;
}

(async () => {
  const files = (await fs.readdir(ESSAYS_DIR)).filter(f => f.endsWith('.md'));
  const essays = [];
  for (const f of files) {
    const src = await fs.readFile(path.join(ESSAYS_DIR, f), 'utf8');
    const { meta, body } = parseFrontMatter(src);
    if (!meta.slug || !meta.title || !meta.date) {
      throw new Error(`${f}: missing required front matter fields (slug, title, date)`);
    }
    essays.push({ ...meta, body });
  }
  essays.sort((a, b) => b.date.localeCompare(a.date));

  // 1) essays.json
  await fs.writeFile(OUT_JSON, JSON.stringify(essays, null, 2) + '\n');

  // 2) feed.xml
  const items = essays.map(e => {
    const link = `${SITE_URL}essays/${e.slug}/`;
    return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <description>${escapeXml(e.excerpt || '')}</description>
    </item>`;
  }).join('\n');
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESC)}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  await fs.writeFile(OUT_FEED, feed);

  // 3) Per-essay pages
  for (let i = 0; i < essays.length; i++) {
    const e = essays[i];
    const prev = i > 0 ? essays[i - 1] : null;
    const next = i < essays.length - 1 ? essays[i + 1] : null;
    const bodyHtml = renderMarkdown(e.body || '');
    const prevLink = prev
      ? `<a href="/essays/${prev.slug}/" style="display:flex;flex-direction:column;padding:16px 20px;border-radius:12px;border:1px solid #e3e0d6;background:#ffffff;font-size:14px;color:#1a1a1a;"><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8a8a86;margin-bottom:4px;font-weight:600;${SANS_STYLE}">Previous</span><span style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:500;">← ${escapeHtml(prev.title)}</span></a>`
      : `<span class="empty"></span>`;
    const nextLink = next
      ? `<a class="next" href="/essays/${next.slug}/" style="display:flex;flex-direction:column;padding:16px 20px;border-radius:12px;border:1px solid #e3e0d6;background:#ffffff;font-size:14px;text-align:right;align-items:flex-end;color:#1a1a1a;"><span style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8a8a86;margin-bottom:4px;font-weight:600;${SANS_STYLE}">Next</span><span style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:500;">${escapeHtml(next.title)} →</span></a>`
      : `<span class="empty"></span>`;

    const page = `${pageHead(`${e.title} — Essays`, e.title)}
  <div style="position:absolute;left:-9999px;top:0;background:#c2410c;color:white;padding:8px 12px;">Skip to content</div>
  ${sharedHeader()}
  <main style="${MAIN_STYLE}${WRAP_STYLE}">
    <article>
      <header style="${POST_HEADER_STYLE}">
        <h1 style="${POST_H1_STYLE}">${escapeHtml(e.title)}</h1>
        <div style="${POST_META_STYLE}">
          <time datetime="${escapeHtml(e.date)}">${escapeHtml(formatDate(e.date))}</time>
          <span style="${CARD_DOT_STYLE}"></span>
          <span>${escapeHtml(readingTime(e.body || ''))}</span>
        </div>
      </header>
      <div style="${CONTENT_STYLE}">${bodyHtml}</div>
      <nav class="post-nav" style="margin-top:72px;padding-top:32px;border-top:1px solid #e3e0d6;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        ${prevLink}
        ${nextLink}
      </nav>
    </article>
  </main>
  ${sharedFooter()}${pageTail()}`;

    const outDir = path.join(ESSAYS_DIR, e.slug);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'index.html'), page);
  }

  // 4) Index page
  const idx = await fs.readFile(INDEX_PATH, 'utf8');
  const cards = essays.map(renderCard).join('\n');
  const updated = idx.replace(/\{\{CARDS\}\}/g, cards);
  await fs.writeFile(INDEX_PATH, updated);

  // 5) About / 404: rebuild with current style template
  const aboutPage = `${pageHead('About — Essays', 'About these essays.')}
  <div style="position:absolute;left:-9999px;top:0;background:#c2410c;color:white;padding:8px 12px;">Skip to content</div>
  ${sharedHeader()}
  <main style="${MAIN_STYLE}${WRAP_STYLE}">
    <section style="${HERO_STYLE}">
      <span class="eyebrow" style="${EYEBROW_STYLE}">About</span>
      <h1 style="${H1_STYLE}">A quiet place on the internet.</h1>
    </section>
    <div class="about-content" style="${CONTENT_STYLE}">
      <p style="${CONTENT_P_STYLE}">These are short essays — written slowly, edited more than written. Some are about software. Some are about language. Most are about the small, persistent questions that don't quite have answers.</p>
      <p style="${CONTENT_P_STYLE}">You can subscribe via <a href="/feed.xml" style="${CONTENT_A_STYLE}">RSS</a>. New essays land here when they're ready, not on a schedule.</p>
    </div>
  </main>
  ${sharedFooter()}${pageTail()}`;
  await fs.writeFile(ABOUT_PATH, aboutPage);

  const notFoundPage = `${pageHead('Not found — Essays', 'Page not found.')}
  <div style="position:absolute;left:-9999px;top:0;background:#c2410c;color:white;padding:8px 12px;">Skip to content</div>
  ${sharedHeader()}
  <main style="${MAIN_STYLE}${WRAP_STYLE}">
    <section style="${HERO_STYLE}">
      <span class="eyebrow" style="${EYEBROW_STYLE}">404</span>
      <h1 style="${H1_STYLE}">Not found.</h1>
      <p style="${LEDE_STYLE}">That page doesn't exist. Try the <a href="/" style="${CONTENT_A_STYLE}">homepage</a> or the <a href="/feed.xml" style="${CONTENT_A_STYLE}">RSS feed</a>.</p>
    </section>
  </main>
  ${sharedFooter()}${pageTail()}`;
  await fs.writeFile(NOTFOUND_PATH, notFoundPage);

  console.log(`Built ${essays.length} essay(s):`);
  for (const e of essays) console.log(`  - ${e.date}  ${e.slug}  → /essays/${e.slug}/`);
})().catch(err => { console.error(err); process.exit(1); });