// Tiny markdown renderer (essays-only subset: headings, paragraphs, lists, blockquote, code, em, strong, links, hr)
// For production consider marked.js — kept dependency-free here.
(function () {
  function escape(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function inline(s) {
    // escape first
    s = escape(s);
    // inline code (greedy within line)
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    // bold + italic
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
      const safe = /^(https?:\/\/|mailto:|\/)/.test(u) ? u : '#';
      return `<a href="${safe}" rel="noopener">${t}</a>`;
    });
    return s;
  }

  function render(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      // hr
      if (/^---+$/.test(line.trim())) { out.push('<hr/>'); i++; continue; }

      // headings
      const h = line.match(/^(#{1,4})\s+(.+)/);
      if (h) {
        out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
        i++; continue;
      }

      // fenced code
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim();
        i++;
        const buf = [];
        while (i < lines.length && !lines[i].startsWith('```')) {
          buf.push(lines[i]); i++;
        }
        i++; // skip closing fence
        const cls = lang ? ` class="lang-${escape(lang)}"` : '';
        out.push(`<pre><code${cls}>${escape(buf.join('\n'))}</code></pre>`);
        continue;
      }

      // blockquote
      if (line.startsWith('> ')) {
        const buf = [];
        while (i < lines.length && lines[i].startsWith('> ')) {
          buf.push(lines[i].slice(2)); i++;
        }
        out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
        continue;
      }

      // unordered list
      if (/^[-*]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          buf.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ul>${buf.join('')}</ul>`);
        continue;
      }

      // ordered list
      if (/^\d+\.\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          buf.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
          i++;
        }
        out.push(`<ol>${buf.join('')}</ol>`);
        continue;
      }

      // paragraph
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|```|[-*]\s|\d+\.\s|---+$)/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      out.push(`<p>${inline(buf.join(' '))}</p>`);
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
    const minutes = Math.max(1, Math.round(words / 220));
    return `${minutes} min read`;
  }

  async function loadList() {
    const list = document.getElementById('essay-list');
    if (!list) return;
    try {
      const res = await fetch('/essays/essays.json');
      if (!res.ok) throw new Error(res.statusText);
      const essays = await res.json();
      if (!essays.length) {
        list.innerHTML = '<p class="empty">No essays yet.</p>';
        return;
      }
      list.innerHTML = essays.map(e => `
        <a class="essay-card" href="/essays/post.html?slug=${encodeURIComponent(e.slug)}">
          <div class="essay-meta">
            <time datetime="${e.date}">${formatDate(e.date)}</time>
            <span class="dot"></span>
            <span>${readingTime(e.body || '')}</span>
          </div>
          <h2>${escape(e.title)}</h2>
          <p>${escape(e.excerpt || '')}</p>
          ${e.tags && e.tags.length ? `<div class="essay-tags">${e.tags.map(t => `<span class="essay-tag">${escape(t)}</span>`).join('')}</div>` : ''}
        </a>
      `).join('');
    } catch (err) {
      list.innerHTML = `<p class="empty">Couldn't load essays: ${escape(err.message)}</p>`;
    }
  }

  async function loadPost() {
    const article = document.getElementById('post-content');
    const titleEl = document.getElementById('post-title');
    const metaEl = document.getElementById('post-meta');
    const prev = document.getElementById('post-prev');
    const next = document.getElementById('post-next');
    if (!article) return;
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    if (!slug) { article.innerHTML = '<p>Missing slug.</p>'; return; }
    try {
      const res = await fetch('/essays/essays.json');
      const all = await res.json();
      const idx = all.findIndex(e => e.slug === slug);
      if (idx === -1) throw new Error('Essay not found');
      const e = all[idx];
      document.title = `${e.title} — Idris`;
      titleEl.textContent = e.title;
      metaEl.innerHTML = `<time datetime="${e.date}">${formatDate(e.date)}</time><span class="dot"></span><span>${readingTime(e.body || '')}</span>`;
      article.innerHTML = render(e.body || '');
      if (idx > 0 && prev) {
        const p = all[idx - 1];
        prev.href = `/essays/post.html?slug=${encodeURIComponent(p.slug)}`;
        prev.querySelector('[data-label]').textContent = p.title;
      } else if (prev) prev.style.visibility = 'hidden';
      if (idx < all.length - 1 && next) {
        const n = all[idx + 1];
        next.href = `/essays/post.html?slug=${encodeURIComponent(n.slug)}`;
        next.querySelector('[data-label]').textContent = n.title;
      } else if (next) next.style.visibility = 'hidden';
    } catch (err) {
      article.innerHTML = `<p>Error: ${escape(err.message)}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadList();
    loadPost();
  });

  // expose for inline pages
  window.Essays = { render, formatDate };
})();
