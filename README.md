# Spot the Hook — HLAC security awareness survey

An anonymous PRE/POST assessment platform for the HLAC *Design and Evaluate a Security Awareness
Program* assignment. Participants complete a short scenario-based survey on **phishing and social
engineering** before and after the campaign. The project team gets a password-protected dashboard
with paired PRE/POST analytics and exports for the report.

- **Participant survey**: no accounts, an informed-consent step, one question per screen,
  keyboard shortcuts, auto-save and resume, realistic message mock-ups, and an anonymous code that
  links the PRE and POST responses.
- **Team dashboard** (`/team`): response counts, completion rates, score distributions, a paired
  comparison with CIs and tests, item-level accuracy and misconceptions, perceived vs demonstrated
  awareness, sample description, an answer key, CSV and Markdown exports, and participant withdrawal.
- **Real persistence**: SQLite with versioned migrations. Scoring and validation happen only on
  the server.

The question rationale, scoring rules and statistical methods are in
**[docs/SURVEY_DESIGN.md](docs/SURVEY_DESIGN.md)**.

---

## Links to share

| Who | URL |
|---|---|
| Everyone, before the campaign | `https://<your-host>/s/pre` |
| Everyone, after the campaign | `https://<your-host>/s/post` |
| Neutral landing page with both | `https://<your-host>/` |
| Privacy & consent notice (link it from social posts) | `https://<your-host>/privacy` |
| **Project team only** | `https://<your-host>/team` |

Locally these are `http://localhost:5173/s/pre`, `/s/post` and `/team` in development, or
`http://localhost:3000/...` after `npm run build && npm start`.

---

## Quick start (local)

Requirements: **Node.js 22+** (see `.nvmrc`; better-sqlite3 crashes on Node 20). The npm scripts
check this and stop with a clear message on older versions.

> **“We couldn't reach the server”** after clicking *I agree* means the page is open but the API
> isn't running. Keep `npm run dev` running in a terminal (on Node 22) while you use the site.

```bash
nvm use            # or otherwise put Node 22 on your PATH
npm install
cp .env.example .env
# edit .env: set ADMIN_PASSWORD (≥ 12 chars) and SESSION_SECRET (see below)
npm run db:init    # creates ./data/hlac.db and applies migrations
npm run dev        # API on :3000, website on :5173 (proxying /api)
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Before sharing the links**, fill in your team name, course, contact email and retention period
in [`web/src/studyInfo.ts`](web/src/studyInfo.ts), and edit the campaign-exposure options
(`r_exposure`) in [`server/survey/definition.ts`](server/survey/definition.ts) to match the
channels you actually used.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-restarts) + Vite dev server |
| `npm run build` | Typecheck everything and build the website into `dist/web` |
| `npm start` | Production server: API + built website on `PORT` |
| `npm test` | Run the automated test suite |
| `npm run db:init` | Create the database / apply pending migrations (also happens on every start) |
| `npm run db:seed-demo` | Insert **clearly flagged** demonstration responses |
| `npm run db:purge-demo` | Delete all demonstration rows (real data untouched) |

---

## Configuration

All configuration is through environment variables (`.env` locally, the host's settings panel in
production). `.env` is gitignored, and `.env.example` contains no real values.

| Variable | Required | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | Production | Shared team password for `/team`, at least 12 characters. If unset in development, the dashboard login is disabled. |
| `SESSION_SECRET` | Production | ≥ 32 random characters; signs dashboard cookies. In development a random per-process secret is used if missing. |
| `DATABASE_PATH` | No | Default `./data/hlac.db`. **Must be on persistent storage in production.** |
| `PORT` / `API_PORT` | No | Listening port (default 3000). `API_PORT` wins if both are set. |
| `TRUST_PROXY` | Behind HTTPS proxy | Set `true` on Render/Railway/Fly/nginx so rate limiting sees real client IPs. |
| `NODE_ENV` | — | `npm start` sets `production`, which enables `Secure` cookies and refuses to start with a missing or weak password or secret. |

---

## Deployment

Any host that runs Node 22 and provides a **persistent disk** works. Example for **Render**:

1. Push this repository to GitHub, then create a *Web Service*.
2. Build command: `npm ci && npm run build`. Start command: `npm start`.
3. Add a **Disk** (1 GB is plenty) mounted at e.g. `/var/data`, and set
   `DATABASE_PATH=/var/data/hlac.db`.
4. Set `ADMIN_PASSWORD`, `SESSION_SECRET` and `TRUST_PROXY=true`. Set the Node version to 22
   (`NODE_VERSION=22`).
5. Deploy, open `/team`, and sign in.

Railway (volume) and Fly.io (volume) work the same way. On a VPS, run `npm start` under a process
manager (systemd/pm2) behind nginx or Caddy with HTTPS.

> Without a persistent disk, the database is wiped on every redeploy. Free tiers that don't
> offer disks are not suitable for collecting real responses.

**Backups:** the whole dataset is one file. Download `responses.csv` from the dashboard
regularly, or copy the database file (`sqlite3 hlac.db ".backup backup.db"`).

---

## Data & privacy

Stored per response: the stage, the random participant code, the survey version, timestamps, the
server-computed duration, each answer with its item score and outcome, and the knowledge score.
Sessions (created at consent) record only stage, code and start/finish time, which gives
completion rates.

**Not collected:** names, emails, phone numbers, student IDs, IP addresses, user agents, or
tracking cookies. Rate limiting keeps IP counters in memory only. Fonts are self-hosted, so no
third-party requests reveal visitors. Participants' in-progress answers stay in their own
browser's local storage until they submit.

**Demographics:** three optional, coarse questions (year, field, prior training), each with
"Prefer not to say". They are included because field of study and prior training plausibly affect
baseline awareness and are useful for describing the sample.

**Withdrawal:** a participant emails their code, and a team member removes all data under that
code from the dashboard's *Withdrawal* tab.

**Demonstration data** is stored with `is_demo = 1`. It is excluded from analytics and exports by
default. When included, the dashboard shows a persistent banner, export filenames gain
`-INCLUDING-DEMO`, and the Markdown summary carries a warning. Remove it before collecting real
data with `npm run db:purge-demo`.

## Security measures

- Answer keys, rationales and misconception labels exist only on the server. The public survey
  endpoint builds its response from an explicit allow-list of fields, and the participant API
  never returns a score.
- Every `/api/admin/*` route requires a signed, expiring (8 h), `HttpOnly`, `SameSite=Strict`
  cookie scoped to `/api/admin` (`Secure` in production). Passwords are compared in constant time,
  and login is limited to 10 attempts per 15 minutes.
- All input is validated with zod and then checked against the survey definition. Unknown
  questions, invalid options or out-of-range values are rejected (HTTP 422). JSON bodies are
  capped at 32 KB.
- All SQL uses prepared statements. CSV exports neutralise spreadsheet formula injection.
- helmet sets a strict CSP (`script-src 'self'`, no third-party origins), HSTS, `nosniff`,
  frame-ancestors none, and no-referrer. Participant API responses are `no-store`.
- Duplicate protection: idempotent submissions per session (safe to retry or double-click), a
  database-enforced one-response-per-code-per-stage rule, and a device-local "already completed"
  notice.

---

## Tests

```bash
npm test
```

The suite covers:

- **Scoring and definition integrity** (`tests/scoring.test.ts`): answer-key consistency, the
  single-choice, partial-credit and "not sure" rules, required and optional handling,
  stage-specific questions, and invalid input.
- **Statistics** (`tests/stats.test.ts`): t, Welch, paired t, Wilcoxon, McNemar, CI, Cohen's d and
  Spearman against R reference values.
- **Participant codes** (`tests/participantCode.test.ts`): format, normalisation, and detection of
  every single-character typo.
- **API integration** (`tests/api.test.ts`, real Express and SQLite):
  - no answer-key leakage and correct security headers;
  - submission persistence, idempotency, validation errors, malformed or oversized bodies,
    SQL-looking input;
  - PRE/POST matching and duplicate blocking;
  - admin authorization (missing, forged, foreign-secret and expired tokens, logout, disabled
    admin, rate limiting);
  - analytics computed from stored data;
  - demo exclusion, CSV columns, the item, codebook and summary exports, and withdrawal;
  - persistence across a restart;
  - production static serving.

---

## Project layout

```
server/
  survey/definition.ts   questions, stages, answer key, misconceptions (single source of truth)
  survey/public.ts       participant-safe view of the survey (allow-list)
  scoring.ts             validation + scoring
  analytics.ts           dashboard report built from the database
  stats.ts               statistics routines
  exports.ts             CSV / Markdown exports
  db.ts                  SQLite connection, migrations, queries
  auth.ts, config.ts     team login, environment config
  app.ts, index.ts       HTTP API and server entry
  scripts/               db:init, seed/purge demo data
shared/                  types and participant-code logic used by server and client
web/src/
  pages/Survey.tsx       participant flow
  components/            question renderer, scenario mock-ups, privacy notice
  dashboard/             team dashboard (lazy-loaded; never downloaded by participants)
tests/                   vitest suites
docs/SURVEY_DESIGN.md    question rationale, scoring and analysis methodology
```

To change the survey, edit `server/survey/definition.ts`. Don't change a question's meaning or
option ids after collection starts; if you must, bump `SURVEY_VERSION`, and the dashboard will
flag responses collected under the older version.

---

## Known limitations

- **No control group.** The platform reports observed PRE→POST change, not causal effect. Item
  wording is identical in both stages, so a testing effect is possible.
- **Small samples.** With ~30 participants, tests have low power, and the Wilcoxon normal
  approximation is rough below ~10 non-zero changes. The dashboard flags both.
- **Matching depends on participants keeping their code.** Lost codes produce unmatched POST
  responses, which are counted but excluded from paired analysis.
- **Duplicate prevention is best-effort without identity.** One person could take PRE twice in
  different browsers. Codes prevent duplicate POSTs per code, but nothing ties a code to a person,
  by design.
- **Single shared admin password.** This is appropriate for a small team; there are no per-user
  accounts or audit log.
- **Rate limits are per IP and in memory.** Students behind one campus NAT share a budget of 1,000
  session starts and 1,000 submissions per 15 minutes, which is ample for class-sized sessions.
  Limits reset on restart.
- **SQLite on one server.** This is fine for hundreds or thousands of responses, but it is not
  designed for horizontal scaling.
- **Codes are bearer tokens.** Anyone who learns a participant's code could submit a POST under it
  first. Participants are told to keep their code private; the team can remove a bad submission
  through *Withdrawal*. Random codes make guessing infeasible (~3.4 × 10¹⁰ possibilities).
- **Dashboard sessions are stateless.** Signing out clears the cookie, but a copied cookie stays
  valid for up to 8 hours. Rotate `SESSION_SECRET` to invalidate every session.
- The scenario stimuli are illustrations, not interactive phishing simulations.
