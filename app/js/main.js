// Pulse's router. Hash routes, rendered in place into <main> — no reloads.
//
//   #/                              the bounty board (loaded eagerly)
//   #/bounty/<slug>                 one bounty's page        (lazy import)
//   #/bounty/<slug>/leaderboard     its leaderboard          (lazy import)
//   #/user/<handle>                 a public profile         (lazy import)
//
// Screenshot protocol: window.__shotReady is false from the moment a route
// starts loading and flips true only once that route's data has rendered.

import { renderBoard } from './views/board.js';
import { timeLeft } from './format.js';

const view = document.getElementById('view');
window.__shotReady = false;

function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'board' };
  if (parts[0] === 'bounty' && parts[1] && parts.length === 2) return { name: 'bounty', slug: parts[1] };
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') return { name: 'leaderboard', slug: parts[1] };
  if (parts[0] === 'user' && parts[1]) return { name: 'profile', handle: parts[1] };
  return { name: 'board' };
}

let current = null; // token so a slow route never overwrites a newer one

async function route() {
  const r = parseRoute();
  const token = (current = {});
  window.__shotReady = false;
  try {
    if (r.name === 'board') {
      await renderBoard(view);
    } else if (r.name === 'bounty') {
      const mod = await import('./views/bounty.js');
      if (current !== token) return;
      await mod.renderBounty(view, r.slug);
    } else if (r.name === 'leaderboard') {
      const mod = await import('./views/leaderboard.js');
      if (current !== token) return;
      await mod.renderLeaderboard(view, r.slug);
    } else if (r.name === 'profile') {
      const mod = await import('./views/profile.js');
      if (current !== token) return;
      await mod.renderProfile(view, r.handle);
    }
    if (current === token) window.__shotReady = true;
  } catch (err) {
    if (current !== token) return;
    view.innerHTML = `<section class="state state-error">
      <h1>Something went wrong</h1>
      <p>${err && err.message ? String(err.message).replaceAll('<', '&lt;') : 'Unknown error'}</p>
      <p><a class="btn" href="#/">Back to the board</a></p>
    </section>`;
    window.__shotReady = true;
  }
}

// One shared ticker: every visible countdown updates in place, once a second.
setInterval(() => {
  const now = Date.now();
  for (const el of document.querySelectorAll('[data-countdown]')) {
    el.textContent = timeLeft(el.dataset.countdown, now);
  }
}, 1000);

window.addEventListener('hashchange', route);
route();
