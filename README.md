# Pulse — a fast make.fun frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/danzosubianto/makefun-pulse/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/danzosubianto/makefun-pulse/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

Pulse is a lightweight, no-build frontend for [make.fun](https://make.fun) — every live bounty on one board, each bounty's full page, its leaderboard, and every entrant's public profile. It is plain HTML, ES modules and CSS in `app/` (no framework, no build step, no external assets) and reads only make.fun's public API with GET requests.

## Surfaces

- `#/` — the board: live bounties as cards with the live pot, entry fee, entry count and a ticking time-left, plus a closed section; search, category filter, three sort orders and client-side pagination (24 per page).
- `#/bounty/<slug>` — summary, full description and rules, the rewards table against the live pot, opened/deadline/result dates, judging method and criteria, and the newest entrants.
- `#/bounty/<slug>/leaderboard` — the API's own ranked table (its columns differ per bounty), with each prize place's current payout, 50 rows per page.
- `#/user/<handle>` — the public profile: record across all bounties entered, and every entry linked back to its bounty.

## Speed

- An ETag cache in `app/js/api.js`: responses are stored with their ETag, reused while fresh, and revalidated with `If-None-Match` afterwards (a 304 costs no body); identical in-flight requests are deduped, so moving between routes never refetches what is already fresh.
- Only the board view ships in the first load; the bounty, leaderboard and profile views load lazily via dynamic `import()`. Views render in place — no page reloads — and a single one-second ticker updates every countdown on screen.
- Dark theme, system fonts, skeleton placeholders, honest empty and error states, and a layout that works at phone width.

## Hand-in

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` using the vendored library in `vendor/makefun-frontend.ts`:

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Serve the app locally with any static file server rooted at `app/`, e.g. `python3 -m http.server -d app 8080`, then open `http://localhost:8080`.
