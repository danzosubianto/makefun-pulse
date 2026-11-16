// A public profile, from GET /profiles/<handle>: who they are, their record
// across every bounty they have entered, and each of their entries — linked
// back to its bounty, with its placement, prize and score where the API has
// them. The avatar is the image the API points at (or the API's own picture
// endpoint for the handle); if it fails to load, initials show instead.

import { get, invalidate, apiUrl } from '../api.js';
import { esc, money, num, dateOnly, dateTime } from '../format.js';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function renderProfile(root, handle) {
  const path = `/profiles/${encodeURIComponent(handle)}`;
  root.innerHTML = `<section class="detail-head"><div class="sk sk-line w40"></div><div class="sk sk-line w70"></div><div class="sk sk-line w50"></div></section><div class="sk sk-block"></div>`;
  let p;
  try {
    p = await get(path);
  } catch (err) {
    const missing = err.status === 404;
    root.innerHTML = `<section class="state state-error">
      <h1>${missing ? 'No such profile' : 'This profile could not load'}</h1>
      <p>${missing ? `make.fun has no public profile for @${esc(handle)}.` : esc(err.message || 'Network error')}</p>
      <p>${missing ? '' : '<button class="btn" id="retry">Retry</button> '}<a class="btn" href="#/">Back to the board</a></p>
    </section>`;
    const retry = root.querySelector('#retry');
    if (retry) retry.addEventListener('click', () => { invalidate(path); renderProfile(root, handle); });
    return;
  }

  const name = p.display_name || p.handle;
  const rec = p.record || {};
  const avatarSrc = p.image || p.avatar || apiUrl(`/profiles/${encodeURIComponent(p.handle)}/picture.png`);
  const initials = esc((p.handle || '?').slice(0, 2).toUpperCase());
  const solutions = p.solutions || [];
  const payouts = p.payouts || [];

  const links = [];
  if (p.github_login) links.push(`<span>GitHub: <strong>${esc(p.github_login)}</strong></span>`);
  if (p.x) links.push(`<span>X: <strong>${esc(p.x)}</strong></span>`);
  if (p.discord) links.push(`<span>Discord: <strong>${esc(p.discord)}</strong></span>`);
  if (p.wallet && p.wallet.address) {
    links.push(`<span>Wallet: ${p.wallet.explorer_url
      ? `<a href="${esc(p.wallet.explorer_url)}" rel="noopener">${esc(p.wallet.address)}</a>`
      : esc(p.wallet.address)}</span>`);
  }

  root.innerHTML = `
  <p class="crumbs"><a href="#/">← Board</a></p>
  <section class="profile-head">
    <div class="avatar-wrap" aria-hidden="true">
      <span class="avatar-initials">${initials}</span>
      <img class="avatar" crossorigin="anonymous" src="${esc(avatarSrc)}" alt="" onerror="this.remove()">
    </div>
    <div>
      <h1>${esc(name)} ${p.house ? '<span class="chip">house</span>' : ''}</h1>
      <p class="byline">@${esc(p.handle)} · joined ${esc(dateOnly(p.joined_at))} · <a href="https://make.fun/u/${esc(p.handle)}" rel="noopener">make.fun profile ↗</a></p>
      ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
      ${links.length ? `<p class="profile-links">${links.join(' · ')}</p>` : ''}
    </div>
  </section>

  <section class="stat-strip" aria-label="Record">
    <div class="stat"><span class="stat-label">Entered</span><span class="stat-value">${esc(num(rec.competitions_entered))}</span></div>
    <div class="stat"><span class="stat-label">Placed</span><span class="stat-value">${esc(num(rec.competitions_placed))}</span></div>
    <div class="stat"><span class="stat-label">Won</span><span class="stat-value">${esc(num(rec.competitions_won))}</span></div>
    <div class="stat"><span class="stat-label">Podiums</span><span class="stat-value">${esc(num(rec.podium_finishes))}</span></div>
    <div class="stat"><span class="stat-label">Best placement</span><span class="stat-value">${rec.best_placement != null ? esc(ordinal(Number(rec.best_placement))) : '—'}</span></div>
    <div class="stat"><span class="stat-label">Prizes won</span><span class="stat-value reward">${esc(money(rec.prize_usd))}</span></div>
  </section>

  <section class="panel">
    <h2>Entries (${solutions.length})</h2>
    ${solutions.length ? `<ul class="entrants">
      ${solutions.map((s) => `<li>
        <a class="entrant-name" href="#/bounty/${esc(s.competition.slug)}">${esc(s.competition.title)}</a>
        <span class="entrant-title">${esc(s.title || 'Untitled entry')}</span>
        <span class="entrant-meta">
          ${s.placement != null ? `placed ${esc(ordinal(Number(s.placement)))} · ` : ''}${s.prize_usd != null && Number.parseFloat(s.prize_usd) > 0 ? `won ${esc(money(s.prize_usd))} · ` : ''}${s.score ? `${esc(s.score.column && s.score.column.title ? s.score.column.title : 'Score')}: ${esc(s.score.display != null ? s.score.display : num(s.score.value))} · ` : ''}${esc(s.competition.category || '')} · entered ${esc(dateTime(s.entered_at))}
        </span>
      </li>`).join('')}
    </ul>` : '<p class="panel-note">No entries yet.</p>'}
  </section>

  ${payouts.length ? `<section class="panel">
    <h2>Payouts</h2>
    <ul class="entrants">
      ${payouts.map((x) => `<li><span class="entrant-title">${esc(money(x.amount_usd ?? x.amount))}</span><span class="entrant-meta">${esc(x.status || '')} · ${esc(dateTime(x.created_at || x.paid_at))}</span></li>`).join('')}
    </ul>
  </section>` : ''}`;
}
