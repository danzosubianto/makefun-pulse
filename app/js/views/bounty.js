// One bounty's page, from GET /competitions/<slug>: the summary and the full
// description and rules text, the rewards table with the live pot worked in,
// the dates that matter (opened, deadline with a ticking countdown, result),
// who sponsors it, how it is judged, and the newest entrants — each linked to
// their profile.

import { get, invalidate } from '../api.js';
import { esc, money, num, dateTime, timeLeft, isLive, renderMarkdown } from '../format.js';

function rewardsRows(c) {
  if (Array.isArray(c.rewardsNow) && c.rewardsNow.length) {
    return c.rewardsNow.map((r) => ({
      place: r.place,
      base: r.baseUsd,
      feeShare: r.feeShareUsd,
      total: r.amountUsd,
    }));
  }
  if (c.rewards && typeof c.rewards === 'object') {
    return Object.entries(c.rewards)
      .map(([place, amount]) => ({ place: Number(place), base: amount, feeShare: null, total: amount }))
      .sort((a, b) => a.place - b.place);
  }
  return [];
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function renderBounty(root, slug) {
  const path = `/competitions/${encodeURIComponent(slug)}`;
  root.innerHTML = `<section class="detail-head"><div class="sk sk-line w40"></div><div class="sk sk-line w90"></div><div class="sk sk-line w70"></div></section>
  <div class="sk sk-block"></div>`;
  let c;
  try {
    c = await get(path);
  } catch (err) {
    root.innerHTML = `<section class="state state-error">
      <h1>This bounty could not load</h1>
      <p>${esc(err.message || 'Network error')}</p>
      <p><button class="btn" id="retry">Retry</button> <a class="btn" href="#/">Back to the board</a></p>
    </section>`;
    root.querySelector('#retry').addEventListener('click', () => { invalidate(path); renderBounty(root, slug); });
    return;
  }

  const now = Date.now();
  const live = isLive(c, now);
  const pot = Number.parseFloat(c.potUsd);
  const fee = c.entryFeeUsd != null ? Number.parseFloat(c.entryFeeUsd) : 0;
  const rows = rewardsRows(c);
  const res = c.resolution || {};
  const recent = [...(c.submissions || [])]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12);
  const resultText = c.resolvedAt
    ? dateTime(c.resolvedAt)
    : (res.announce ? esc(res.announce) : 'Pending');

  root.innerHTML = `
  <p class="crumbs"><a href="#/">← Board</a></p>
  <section class="detail-head">
    <div class="card-top">
      <span class="chip">${esc(c.category || 'Bounty')}</span>
      <span class="badge ${live ? 'badge-live' : 'badge-closed'}">${live ? '● Live' : 'Closed'}${c.status ? ` · ${esc(c.status)}` : ''}</span>
    </div>
    <h1>${esc(c.title)}</h1>
    ${c.summary ? `<p class="lede">${esc(c.summary)}</p>` : ''}
    <p class="byline">
      Sponsored by <strong>${esc(c.sponsor && c.sponsor.name ? c.sponsor.name : 'make.fun')}</strong>${c.sponsor && c.sponsor.isVerified ? ' ✓' : ''}
      ${(c.skills || []).length ? ` · ${(c.skills || []).map(esc).join(' · ')}` : ''}
    </p>
  </section>

  <section class="stat-strip" aria-label="Key numbers">
    <div class="stat"><span class="stat-label">Live pot</span><span class="stat-value reward">${esc(money(Number.isNaN(pot) ? c.rewardAmount : pot))}</span></div>
    <div class="stat"><span class="stat-label">Base reward</span><span class="stat-value">${esc(money(c.rewardAmount))}</span></div>
    <div class="stat"><span class="stat-label">Entry fee</span><span class="stat-value">${fee > 0 ? esc(money(fee)) : 'Free'}</span></div>
    <div class="stat"><span class="stat-label">Entries</span><span class="stat-value">${esc(num(c.submissionCount))}</span></div>
    <div class="stat"><span class="stat-label">${live ? 'Time left' : 'Deadline'}</span><span class="stat-value" ${live ? `data-countdown="${esc(c.deadline)}"` : ''}>${live ? esc(timeLeft(c.deadline, now)) : esc(dateTime(c.deadline))}</span></div>
  </section>

  <div class="detail-actions">
    <a class="btn btn-primary" href="#/bounty/${esc(c.slug)}/leaderboard">Leaderboard</a>
    <a class="btn" href="https://make.fun/bounty/${esc(c.slug)}" rel="noopener">Open on make.fun ↗</a>
  </div>

  <section class="panel">
    <h2>Dates &amp; status</h2>
    <dl class="facts">
      <div><dt>Opened</dt><dd>${esc(dateTime(c.opensAt || c.publishedAt))}</dd></div>
      <div><dt>Deadline</dt><dd>${esc(dateTime(c.deadline))}</dd></div>
      <div><dt>Result</dt><dd>${resultText}</dd></div>
      <div><dt>Status</dt><dd>${esc(c.status || (live ? 'open' : 'closed'))}${c.placementsHeld ? ' · placements held until final' : ''}</dd></div>
      ${fee > 0 ? `<div><dt>Fees collected</dt><dd>${esc(money(c.entryFeesUsd))} from ${esc(num(c.entryFeePayers))} payers</dd></div>` : ''}
    </dl>
  </section>

  ${rows.length ? `<section class="panel">
    <h2>Rewards ${live ? '<span class="panel-note">live pot, incl. fee share</span>' : ''}</h2>
    <table class="table">
      <thead><tr><th>Place</th><th>Base</th><th>Fee share</th><th>Pays</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><td>${esc(ordinal(Number(r.place)))}</td><td>${esc(money(r.base))}</td><td>${r.feeShare != null ? esc(money(r.feeShare)) : '—'}</td><td class="reward"><strong>${esc(money(r.total))}</strong></td></tr>`).join('')}
      </tbody>
    </table>
  </section>` : ''}

  ${res.summary || (res.criteria || []).length ? `<section class="panel prose">
    <h2>How it is judged</h2>
    ${res.method ? `<p><strong>Method:</strong> ${esc(res.method)}${res.metric && res.metric.name ? ` · <strong>Metric:</strong> ${esc(res.metric.name)} (${esc(res.metric.better || '')} is better)` : ''}</p>` : ''}
    ${res.summary ? `<p>${esc(res.summary)}</p>` : ''}
    ${(res.criteria || []).length ? `<ul>${res.criteria.map((x) => `<li>${esc(typeof x === 'string' ? x : x.title || x.text || JSON.stringify(x))}</li>`).join('')}</ul>` : ''}
  </section>` : ''}

  ${c.description ? `<section class="panel prose">
    <h2>About this bounty</h2>
    ${renderMarkdown(c.description)}
  </section>` : ''}

  ${c.rules ? `<section class="panel prose">
    <h2>Rules</h2>
    ${renderMarkdown(c.rules)}
    ${c.rulesNote ? `<p class="panel-note">${esc(c.rulesNote)}</p>` : ''}
  </section>` : ''}

  ${recent.length ? `<section class="panel">
    <h2>Newest entrants</h2>
    <ul class="entrants">
      ${recent.map((s) => `<li>
        <a class="entrant-name" href="#/user/${esc(s.hunter)}">@${esc(s.hunter)}</a>
        <span class="entrant-title">${esc(s.title || 'Untitled entry')}</span>
        <span class="entrant-meta">${esc(s.status || '')}${s.score != null ? ` · score ${esc(num(s.score))}` : ''} · ${esc(dateTime(s.createdAt))}</span>
      </li>`).join('')}
    </ul>
    <p class="panel-note">Full ranking on the <a href="#/bounty/${esc(c.slug)}/leaderboard">leaderboard</a>.</p>
  </section>` : ''}`;
}
