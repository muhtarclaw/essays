// Theme toggle with system preference + persistence
(function () {
  const STORAGE_KEY = 'essays-theme';
  const root = document.documentElement;

  function getPreferred() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function swapIcons(theme) {
    const sun = document.querySelector('.icon-sun');
    const moon = document.querySelector('.icon-moon');
    if (theme === 'dark') {
      if (sun) sun.style.display = 'block';
      if (moon) moon.style.display = 'none';
    } else {
      if (sun) sun.style.display = 'none';
      if (moon) moon.style.display = 'block';
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    swapIcons(theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }

  function init() {
    apply(getPreferred());
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        apply(next);
      });
    }
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();