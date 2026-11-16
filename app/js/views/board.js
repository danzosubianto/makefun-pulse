// The bounty board: every competition from GET /competitions, split by its
// deadline into live and closed (the API's status can lag past a deadline, so
// the deadline itself decides). Live cards lead with the three numbers a
// hunter scans for — the live pot, the entry fee, the ticking time left —
// and the whole list is searchable, filterable by category, sortable, and
// paged 24 at a time, all client-side over the one cached response.

import { get, invalidate } from '../api.js';
import { esc, money, num, timeLeft, isLive } from '../format.js';

const PAGE_SIZE = 24;

const state = {
  items: null, // null until the first successful load
  query: '',
  category: 'all',
  sort: 'ending',
  page: 1,
};

function feeOf(item) {
  const fee = item.entryFeeUsd != null ? Number.parseFloat(item.entryFeeUsd) : 0;
  return fee > 0 ? fee : 0;
}

function potOf(item) {
  const pot = Number.parseFloat(item.potUsd);
  return Number.isNaN(pot) ? item.rewardAmount : pot;
}

function card(item, now) {
  const live = isLive(item, now);
  const fee = feeOf(item);
  const sponsor = item.sponsor && item.sponsor.name ? item.sponsor.name : '';
  return `<a class="card${live ? '' : ' card-closed'}" href="#/bounty/${esc(item.slug)}">
    <div class="card-top">
      <span class="chip">${esc(item.category || 'Bounty')}</span>
      ${live
        ? `<span class="time-left" data-countdown="${esc(item.deadline)}">${esc(timeLeft(item.deadline, now))}</span>`
        : '<span class="time-left time-closed">closed</span>'}
    </div>
    <h3 class="card-title">${esc(item.title)}</h3>
    <div class="card-numbers">
      <div class="num-block">
        <span class="num-label">${live ? 'Live pot' : 'Reward'}</span>
        <span class="num-value reward">${esc(money(potOf(item)))}</span>
      </div>
      <div class="num-block">
        <span class="num-label">Entry fee</span>
        <span class="num-value">${fee > 0 ? esc(money(fee)) : 'Free'}</span>
      </div>
      <div class="num-block">
        <span class="num-label">Entries</span>
        <span class="num-value">${esc(num(item.submissionCount))}</span>
      </div>
    </div>
    <div class="card-foot">
      <span>${esc(sponsor)}${item.sponsor && item.sponsor.isVerified ? ' ✓' : ''}</span>
      <span>${(item.skills || []).slice(0, 3).map(esc).join(' · ')}</span>
    </div>
  </a>`;
}

function skeleton() {
  return `<div class="grid" aria-hidden="true">${'<div class="card skeleton-card"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div><div class="sk sk-line w50"></div></div>'.repeat(6)}</div>`;
}

function visibleLive() {
  const now = Date.now();
  let list = state.items.filter((i) => isLive(i, now));
  if (state.category !== 'all') list = list.filter((i) => i.category === state.category);
  if (state.query) {
    const q = state.query.toLowerCase();
    list = list.filter((i) =>
      (i.title || '').toLowerCase().includes(q) ||
      (i.slug || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.skills || []).some((s) => s.toLowerCase().includes(q)));
  }
  const by = {
    ending: (a, b) => new Date(a.deadline) - new Date(b.deadline),
    reward: (a, b) => potOf(b) - potOf(a),
    entries: (a, b) => (b.submissionCount || 0) - (a.submissionCount || 0),
  }[state.sort];
  return list.sort(by);
}

// The results region: live grid + pager. Repainted on its own while the user
// types, so the search box never loses focus.
function resultsHtml() {
  const now = Date.now();
  const live = visibleLive();
  const pages = Math.max(1, Math.ceil(live.length / PAGE_SIZE));
  if (state.page > pages) state.page = pages;
  const pageItems = live.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  return `
  ${pageItems.length
    ? `<div class="grid">${pageItems.map((i) => card(i, now)).join('')}</div>`
    : '<div class="state"><h2>No live bounties match</h2><p>Try a different search or category.</p></div>'}
  ${pages > 1 ? `<nav class="pager" aria-label="Board pages">
      <button class="btn" data-pager="prev" ${state.page <= 1 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${state.page} of ${pages}</span>
      <button class="btn" data-pager="next" ${state.page >= pages ? 'disabled' : ''}>Next →</button>
    </nav>` : ''}`;
}

function paintResults(root) {
  const box = root.querySelector('#results');
  if (!box) return;
  box.innerHTML = resultsHtml();
  box.querySelectorAll('[data-pager]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.page += btn.dataset.pager === 'next' ? 1 : -1;
      paintResults(root);
      window.scrollTo({ top: 0 });
    });
  });
}

function paint(root) {
  const now = Date.now();
  const liveCount = state.items.filter((i) => isLive(i, now)).length;
  const closed = state.items.filter((i) => !isLive(i, now));
  const categories = [...new Set(state.items.map((i) => i.category).filter(Boolean))].sort();

  root.innerHTML = `
  <section class="board-head">
    <h1>Live bounties</h1>
    <p class="lede">${liveCount} open on make.fun right now — pots, fees and deadlines, straight from the API.</p>
    <div class="controls">
      <label class="control grow">
        <span class="sr-only">Search bounties</span>
        <input id="q" type="search" placeholder="Search title, skill, category…" value="${esc(state.query)}" autocomplete="off">
      </label>
      <label class="control">
        <span class="sr-only">Category</span>
        <select id="cat">
          <option value="all">All categories</option>
          ${categories.map((c) => `<option value="${esc(c)}"${c === state.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </label>
      <label class="control">
        <span class="sr-only">Sort</span>
        <select id="sort">
          <option value="ending"${state.sort === 'ending' ? ' selected' : ''}>Ending soon</option>
          <option value="reward"${state.sort === 'reward' ? ' selected' : ''}>Biggest reward</option>
          <option value="entries"${state.sort === 'entries' ? ' selected' : ''}>Most entries</option>
        </select>
      </label>
    </div>
  </section>
  <div id="results"></div>
  ${closed.length ? `<section class="closed-head">
      <h2>Closed bounties</h2>
      <p class="lede">${closed.length} past their deadline — results and leaderboards stay readable.</p>
    </section>
    <div class="grid">${closed.map((i) => card(i, now)).join('')}</div>` : ''}`;

  paintResults(root);
  root.querySelector('#q').addEventListener('input', (e) => {
    state.query = e.target.value;
    state.page = 1;
    paintResults(root);
  });
  root.querySelector('#cat').addEventListener('change', (e) => { state.category = e.target.value; state.page = 1; paint(root); });
  root.querySelector('#sort').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; paintResults(root); });
}

export async function renderBoard(root) {
  if (!state.items) {
    root.innerHTML = `<section class="board-head"><h1>Live bounties</h1><p class="lede">Loading the board…</p></section>${skeleton()}`;
    try {
      const data = await get('/competitions');
      state.items = Array.isArray(data) ? data : data.items || [];
    } catch (err) {
      root.innerHTML = `<section class="state state-error">
        <h1>The board could not load</h1>
        <p>${esc(err.message || 'Network error')}</p>
        <p><button class="btn" id="retry">Retry</button></p>
      </section>`;
      root.querySelector('#retry').addEventListener('click', () => { invalidate('/competitions'); renderBoard(root); });
      return;
    }
  }
  paint(root);
}
