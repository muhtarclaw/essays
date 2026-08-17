#!/usr/bin/env node
// Build essays.json + feed.xml from essays/*.md front matter.
// Run: node scripts/build.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ESSAYS_DIR = path.join(ROOT, 'essays');
const OUT_JSON = path.join(ESSAYS_DIR, 'essays.json');
const OUT_FEED = path.join(ROOT, 'feed.xml');
const SITE_URL = process.env.SITE_URL || 'https://example.com';
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

function escapeXml(s) {
  return s.replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;'
  }[c]));
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

  await fs.writeFile(OUT_JSON, JSON.stringify(essays, null, 2) + '\n');

  const items = essays.map(e => {
    const link = `${SITE_URL}/essays/post.html?slug=${encodeURIComponent(e.slug)}`;
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

  console.log(`Built ${essays.length} essay(s):`);
  for (const e of essays) console.log(`  - ${e.date}  ${e.slug}`);
})().catch(err => { console.error(err); process.exit(1); });
