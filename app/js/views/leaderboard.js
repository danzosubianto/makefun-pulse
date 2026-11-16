// A bounty's leaderboard, from GET /competitions/<slug>/leaderboard. The API
// names its own score columns (they differ per bounty — judge win rate here,
// a PnL there), so the table is built from the response's column list and its
// pre-formatted display values. Prizes come from the bounty's rewards table:
// a row's prize rank maps to the amount that place pays right now. Fifty rows
// a page, client-side, over the one cached response.

import { get, invalidate } from '../api.js';
import { esc, money, num } from '../format.js';

const PAGE_SIZE = 50;
let page = 1;

function prizeMap(comp) {
  const map = new Map();
  if (comp && Array.isArray(comp.rewardsNow)) {
    for (const r of comp.rewardsNow) map.set(Number(r.place), r.amountUsd);
  } else if (comp && comp.rewards) {
    for (const [place, amount] of Object.entries(comp.rewards)) map.set(Number(place), amount);
  }
  return map;
}

export async function renderLeaderboard(root, slug) {
  page = 1;
  const lbPath = `/competitions/${encodeURIComponent(slug)}/leaderboard`;
  const compPath = `/competitions/${encodeURIComponent(slug)}`;
  root.innerHTML = `<p class="crumbs"><a href="#/bounty/${esc(slug)}">← Bounty</a></p>
  <section class="detail-head"><div class="sk sk-line w40"></div><div class="sk sk-line w70"></div></section>
  <div class="sk sk-block"></div>`;

  let lb;
  let comp = null;
  try {
    [lb, comp] = await Promise.all([
      get(lbPath),
      get(compPath).catch(() => null), // prizes are a bonus; the board stands without them
    ]);
  } catch (err) {
    root.innerHTML = `<section class="state state-error">
      <h1>This leaderboard could not load</h1>
      <p>${esc(err.message || 'Network error')}</p>
      <p><button class="btn" id="retry">Retry</button> <a class="btn" href="#/bounty/${esc(slug)}">Back to the bounty</a></p>
    </section>`;
    root.querySelector('#retry').addEventListener('click', () => { invalidate(lbPath); renderLeaderboard(root, slug); });
    return;
  }

  const entries = lb.entries || [];
  const columns = (lb.columns || []).filter((col) => !col.hidden);
  const prizes = prizeMap(comp);
  const title = comp && comp.title ? comp.title : slug;
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));

  function paint() {
    if (page > pages) page = pages;
    const rows = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    root.innerHTML = `
    <p class="crumbs"><a href="#/bounty/${esc(slug)}">← ${esc(title)}</a> · <a href="#/">Board</a></p>
    <section class="detail-head">
      <h1>Leaderboard</h1>
      <p class="lede">${esc(lb.title || 'Results')} — ${esc(num(entries.length))} ranked entries${lb.phase && lb.phase.title ? ` · phase: ${esc(lb.phase.title)}` : ''}</p>
    </section>
    ${entries.length ? `<div class="table-wrap"><table class="table lb-table">
      <thead><tr>
        <th>Rank</th><th>Entrant</th>
        ${columns.map((col) => `<th>${esc(col.title)}</th>`).join('')}
        <th>Prize</th>
      </tr></thead>
      <tbody>
        ${rows.map((e) => {
          const prize = e.prize_eligible && e.prize_rank != null ? prizes.get(Number(e.prize_rank)) : undefined;
          return `<tr>
          <td class="rank">${e.rank != null ? esc(num(e.rank)) : '—'}</td>
          <td>
            <a class="entrant-name" href="#/user/${esc(e.handle)}">@${esc(e.handle)}</a>
            ${e.title ? `<span class="entrant-title">${esc(e.title)}</span>` : ''}
            ${e.house ? '<span class="chip chip-small">house</span>' : ''}${e.baseline ? '<span class="chip chip-small">baseline</span>' : ''}
          </td>
          ${columns.map((col) => `<td>${esc(e.display && e.display[col.key] != null ? e.display[col.key] : (e.values && e.values[col.key] != null ? num(e.values[col.key]) : '—'))}</td>`).join('')}
          <td class="reward">${prize != null ? `<strong>${esc(money(prize))}</strong>` : '—'}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    ${pages > 1 ? `<nav class="pager" aria-label="Leaderboard pages">
      <button class="btn" data-pager="prev" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${page} of ${pages}</span>
      <button class="btn" data-pager="next" ${page >= pages ? 'disabled' : ''}>Next →</button>
    </nav>` : ''}` : '<div class="state"><h2>No ranked entries yet</h2><p>Nothing has been scored for this bounty so far.</p></div>'}`;
    root.querySelectorAll('[data-pager]').forEach((btn) => {
      btn.addEventListener('click', () => {
        page += btn.dataset.pager === 'next' ? 1 : -1;
        paint();
        window.scrollTo({ top: 0 });
      });
    });
  }

  paint();
}
