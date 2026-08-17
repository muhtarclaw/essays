#!/usr/bin/env node
// Build site: regenerate essays.json + feed.xml + per-essay HTML pages,
// with CSS INLINED into every page (so the site renders correctly even in
// minimal in-app browsers that block external stylesheets).
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
const CSS_PATH = path.join(ROOT, 'assets/style.css');
const SITE_URL = process.env.SITE_URL || 'https://muhtarclaw.github.io/essays/';
const SITE_TITLE = 'Essays';
const SITE_DESC = 'Short essays on software, language, and the small things.';

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
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    const safe = /^(https?:\/\/|mailto:|\/|#)/.test(u) ? u : '#';
    const ext = /^https?:/.test(safe);
    return `<a href="${safe}"${ext ? ' rel="noopener"' : ''}>${t}</a>`;
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
    if (/^---+$/.test(L.trim())) { out.push('<hr/>'); i++; continue; }
    const h = L.match(/^(#{1,4})\s+(.+)/);
    if (h) { out.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (L.startsWith('```')) {
      const lang = L.slice(3).trim(); i++;
      const buf = [];
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++;
      const cls = lang ? ` class="lang-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (L.startsWith('> ')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; }
      out.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(L)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(`<li>${renderInline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${buf.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(L)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(`<li>${renderInline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${buf.join('')}</ol>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() &&
      !/^(#{1,4}\s|>|```|[-*]\s|\d+\.\s|---+$)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${renderInline(buf.join(' '))}</p>`);
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

const STYLE_TAG = (css) => `<style>${css}</style>`;

(async () => {
  const css = await fs.readFile(CSS_PATH, 'utf8');

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

  // 3) Per-essay pages at /essays/<slug>/index.html
  const tpl = await fs.readFile(POST_TEMPLATE, 'utf8');
  for (let i = 0; i < essays.length; i++) {
    const e = essays[i];
    const prev = i > 0 ? essays[i - 1] : null;
    const next = i < essays.length - 1 ? essays[i + 1] : null;
    const html = renderMarkdown(e.body || '');
    const htmlOut = tpl
      .replace(/\{\{STYLE\}\}/g, STYLE_TAG(css))
      .replace(/\{\{TITLE\}\}/g, escapeHtml(e.title))
      .replace(/\{\{DATE_ISO\}\}/g, escapeHtml(e.date))
      .replace(/\{\{DATE_FMT\}\}/g, escapeHtml(formatDate(e.date)))
      .replace(/\{\{READING_TIME\}\}/g, escapeHtml(readingTime(e.body || '')))
      .replace(/\{\{BODY_HTML\}\}/g, html)
      .replace(/\{\{PREV_LINK\}\}/g, prev ? `<a href="/essays/${prev.slug}/">← <span class="title">${escapeHtml(prev.title)}</span></a>` : `<span class="empty"></span>`)
      .replace(/\{\{NEXT_LINK\}\}/g, next ? `<a class="next" href="/essays/${next.slug}/"><span class="title">${escapeHtml(next.title)}</span> →</a>` : `<span class="empty"></span>`);
    const outDir = path.join(ESSAYS_DIR, e.slug);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'index.html'), htmlOut);
  }

  // 4) Inline cards into index.html
  const cards = essays.map(e => `
      <a class="essay-card" href="/essays/${e.slug}/">
        <div class="essay-meta">
          <time datetime="${escapeHtml(e.date)}">${escapeHtml(formatDate(e.date))}</time>
          <span class="dot"></span>
          <span>${escapeHtml(readingTime(e.body || ''))}</span>
        </div>
        <h2>${escapeHtml(e.title)}</h2>
        <p>${escapeHtml(e.excerpt || '')}</p>
        ${e.tags && e.tags.length ? `<div class="essay-tags">${e.tags.map(t => `<span class="essay-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </a>`).join('\n');

  const idx = await fs.readFile(INDEX_PATH, 'utf8');
  const updated = idx
    .replace(/\{\{STYLE\}\}/g, STYLE_TAG(css))
    .replace(/\{\{CARDS\}\}/g, cards);
  await fs.writeFile(INDEX_PATH, updated);

  // 5) Inline CSS into about + 404 too
  for (const filePath of [ABOUT_PATH, NOTFOUND_PATH]) {
    const html = await fs.readFile(filePath, 'utf8');
    if (html.includes('{{STYLE}}')) {
      await fs.writeFile(filePath, html.replace(/\{\{STYLE\}\}/g, STYLE_TAG(css)));
    }
  }

  console.log(`Built ${essays.length} essay(s):`);
  for (const e of essays) console.log(`  - ${e.date}  ${e.slug}  → /essays/${e.slug}/`);
})().catch(err => { console.error(err); process.exit(1); });