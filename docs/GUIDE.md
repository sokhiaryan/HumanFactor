# Spot the Hook — Team Guide

A complete guide for the HLAC project team: how to run the platform, run the study, use the
dashboard, export data, and handle participants. No programming knowledge is needed except in the
sections marked **(maintainer)**.

**Contents**

1. [What the platform does](#1-what-the-platform-does)
2. [Running it on your computer](#2-running-it-on-your-computer-maintainer)
3. [The participant experience](#3-the-participant-experience)
4. [Running the study, step by step](#4-running-the-study-step-by-step)
5. [Sharing the survey links](#5-sharing-the-survey-links)
6. [The team dashboard](#6-the-team-dashboard)
7. [Exports and using the data](#7-exports-and-using-the-data)
8. [Writing up the results](#8-writing-up-the-results)
9. [Participant support: lost codes and withdrawals](#9-participant-support-lost-codes-and-withdrawals)
10. [Demonstration data](#10-demonstration-data)
11. [Editing the survey](#11-editing-the-survey-maintainer)
12. [Deploying online](#12-deploying-online-maintainer)
13. [Backups and resetting](#13-backups-and-resetting-maintainer)
14. [Privacy and security: team responsibilities](#14-privacy-and-security-team-responsibilities)
15. [Troubleshooting](#15-troubleshooting)
16. [FAQ](#16-faq)
17. [Command reference](#17-command-reference)

---

## 1. What the platform does

Spot the Hook measures how well people recognise **phishing and social-engineering scams**
before and after our awareness campaign.

| Part | Address | Who uses it |
|---|---|---|
| First survey (before the campaign) | `/s/pre` | Participants |
| Follow-up survey (after the campaign) | `/s/post` | Participants |
| Landing page linking both surveys | `/` | Participants |
| Privacy & consent information | `/privacy` | Participants |
| **Team dashboard** (password protected) | `/team` | Project team only |

How it fits together:

1. A participant takes the **PRE** survey and receives an anonymous **participant code**
   (e.g. `K7QM-3XP9`).
2. We run the campaign.
3. The participant takes the **POST** survey and enters the same code.
4. The dashboard matches PRE and POST by code and shows what changed. No names or emails are
   ever collected.

The survey content (10 scenario questions, scoring rules, and why each question was chosen) is
explained in [SURVEY_DESIGN.md](SURVEY_DESIGN.md).

---

## 2. Running it on your computer (maintainer)

### One-time setup

You need **Node.js 22 or newer** and **Git**.

1. **Get the code:**
   ```bash
   git clone https://github.com/sokhiaryan/HumanFactor.git
   cd HumanFactor
   ```
2. **Use Node 22.** If you have [nvm](https://github.com/nvm-sh/nvm):
   ```bash
   nvm install 22 && nvm use
   ```
   Check with `node -v`; it must print `v22` or higher. On an older version, the scripts stop
   with a message telling you to upgrade.
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Create your settings file:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` in a text editor and set:
   - `ADMIN_PASSWORD`: the dashboard password, at least 12 characters.
   - `SESSION_SECRET`: a long random string. Generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   `.env` is never uploaded to GitHub, so each person has their own.
5. **Create the database:**
   ```bash
   npm run db:init
   ```

### Every time you use it

```bash
nvm use
npm run dev
```

Leave this terminal window open. The site works only while it runs. Then open:

- Survey: <http://localhost:5173/s/pre> and <http://localhost:5173/s/post>
- Dashboard: <http://localhost:5173/team>

Press `Ctrl + C` in the terminal to stop.

> Running on your own computer is for testing and preparation. Real participants need the
> deployed online version (section 12), because they can't reach your laptop.

---

## 3. The participant experience

Know this flow well so you can answer participants' questions.

### PRE survey (`/s/pre`)

1. **Introduction.** Explains the study, the time needed (about 7 minutes), that it's anonymous,
   and that "I'm not sure" is always an acceptable answer.
2. **Consent.** A short summary plus an expandable full information sheet. Participants must tick
   *"I am 18 or older, I have read the information above, and I agree to take part"* before the
   button activates.
3. **Participant code.** The site shows the anonymous code, with **Copy** and **Save as file**
   buttons. Participants should screenshot or save it, because they need it for the follow-up.
4. **Questions, one per screen (15 in total):**
   - 3 optional "about you" questions (year, field of study, prior training). These can be
     skipped.
   - 1 confidence rating (1–5).
   - 10 scenario questions, some showing a realistic email, text message, chat, phone
     notification or QR sticker.
   - 1 self-estimate: "how many of the 10 did you get right?"
5. **Review.** Shows how many questions are answered. Participants can open the list and change
   any answer.
6. **Submit**, then a **thank-you screen**, which shows the code again.

### POST survey (`/s/post`)

Same introduction and consent, then:

- **Enter code.** The participant types the code from PRE. Capitals, dashes and spaces don't
  matter. A mistyped character is caught immediately ("That code doesn't look right").
  - **Code not found:** they can re-check it or choose *Use this code anyway*.
  - **"I don't have my code":** they can continue without one. Their answers count in the overall
    results but can't be compared with their first survey.
- **13 questions.** No "about you" questions this time; adds a final question asking which parts
  of the campaign they saw.

### Helpful behaviour built in

| Feature | What participants see |
|---|---|
| Auto-save | Answers are saved on their device. If they close the tab or refresh, they see *Continue where I left off*. |
| Keyboard shortcuts | Number keys pick options, Enter goes to the next question. |
| Required questions | Clicking *Next* without answering shows "Choose an answer to continue." |
| Connection problems | A red message appears. Answers are kept, and they just click *Submit* again. |
| Already completed | Revisiting on the same device shows "You already completed this survey" with their code. On a shared device, *Someone else is taking it* lets the next person start. |
| Duplicate protection | A code can submit only one POST response. A second attempt shows "Already recorded". |
| No answers revealed | Participants never see correct answers or their score. Showing them after PRE would influence the POST results. |

The survey works on phones, tablets and computers, in light and dark mode.

---

## 4. Running the study, step by step

### Before launch

- [ ] Fill in the study details in `web/src/studyInfo.ts`: team name, course, institution,
      **contact email** and **data retention period**. These appear on the consent and privacy
      pages.
- [ ] Edit the campaign channels in the POST "exposure" question (`r_exposure` in
      `server/survey/definition.ts`) to match what we actually run (section 11).
- [ ] Deploy the site online (section 12).
- [ ] **Do a test run yourselves on the deployed site, then wipe the test data** (section 13).
      Otherwise your test answers count as real participants.
- [ ] Check the dashboard shows *No responses yet*.
- [ ] Prepare posts, messages and QR codes with the PRE link (section 5).

### Phase 1: PRE survey

- Share the `/s/pre` link. Tell people to **save their code**.
- Watch the dashboard's **Overview** tab. Aim for **at least 30 responses**, as the brief
  recommends. A warning shows until you reach that.
- Don't start the campaign for a group until they've done the PRE survey.

### Phase 2: Campaign

- Run the awareness campaign (posts, videos, posters, session, and so on).
- Remind participants to keep their code. A post such as "Got your Spot the Hook code? Keep it
  for part 2!" helps.

### Phase 3: POST survey

- Share the `/s/post` link with the **same people**. Remind them to have their code ready.
- Watch **Matched pairs** on the Overview tab. That number drives the main analysis.

### Closing

- Stop sharing links. The surveys stay open, so if you need a hard close, a maintainer stops the
  server.
- Download all exports (section 7) and keep them with the report.
- Delete the data at the end of the retention period you promised (section 13).

---

## 5. Sharing the survey links

Replace `<your-host>` with the deployed address.

| Use | Link |
|---|---|
| First survey | `https://<your-host>/s/pre` |
| Follow-up survey | `https://<your-host>/s/post` |
| Privacy notice (good to link in posts) | `https://<your-host>/privacy` |

**Tips**

- Link directly to `/s/pre` or `/s/post` rather than the home page, so nobody picks the wrong
  survey.
- For posters and in-person sessions, turn the link into a QR code with any QR generator.
- When the dashboard has no responses, it shows both links with **Copy** buttons.
- Never share the `/team` link or the password publicly.

**Message template (PRE):**

> 🎣 Can you spot a scam? Take our 7-minute anonymous survey for our HLAC security awareness
> project. No name or email needed. You'll get a code at the end, so keep it for the short
> follow-up! 👉 https://&lt;your-host&gt;/s/pre

**Message template (POST):**

> Thanks for taking part in Spot the Hook! Here's the 6-minute follow-up. Have your code from
> the first survey ready 🔑 👉 https://&lt;your-host&gt;/s/post

---

## 6. The team dashboard

### Signing in

1. Go to `https://<your-host>/team` (or <http://localhost:5173/team> locally).
2. Enter the **team password**. That's the `ADMIN_PASSWORD` set in `.env` locally, or in the
   hosting settings online. Get it from the maintainer privately.
3. You stay signed in for **8 hours** on that browser.

After **10 wrong passwords**, sign-in is blocked for 15 minutes.

### The header

| Control | What it does |
|---|---|
| **Updated hh:mm:ss** | When the numbers were last loaded. Data refreshes automatically every 15 seconds, and when you return to the tab. |
| **Refresh** | Reload the numbers now. |
| **Print report** | Print or save as PDF. All sections print with every question expanded and the buttons hidden. |
| **Sign out** | End your session on this browser. |
| Tabs | Overview · PRE vs POST · Questions · Perception · Sample · Exports · Answer key · Withdrawal. The address bar remembers the tab (`?view=…`), so you can bookmark one. |
| **Include demonstration data** | Only appears if demo data exists (section 10). Leave it **off** for real results. |

### Overview: *Collection at a glance*

- **Total responses**, split into PRE and POST.
- **PRE / POST completion**: submitted ÷ started (a session starts when someone ticks consent).
- **Matched pairs**: participants whose code appears in both surveys, plus the number of POST
  responses without a PRE match.
- **Median time** to complete each survey.
- **Sample size & data quality**: warnings for fewer than 30 responses, abandoned surveys,
  unmatched codes, and answers collected under an older survey version. Read these before
  presenting any numbers.
- **Knowledge scores** table per stage: n, mean, 95% confidence interval, median, IQR, standard
  deviation, range. Scores are out of 10.
- **Score distribution** chart: how many people got each score, PRE vs POST. Bars show the
  *share* of each group, so groups of different size compare fairly.

### PRE vs POST: *What changed — and what we can claim*

- **Interpreting these results** panel: read it before writing anything. It explains why an
  improvement isn't proof the campaign caused it.
- **Paired comparison** (the main result; uses matched participants only):
  - Mean score PRE → POST.
  - **Mean change** with a **95% confidence interval**. If the interval includes 0, the data are
    consistent with no change.
  - **Paired t-test** and **Wilcoxon signed-rank** test (p-values). Wilcoxon doesn't assume
    normally distributed scores, which is a useful check with small samples.
  - **Effect size (Cohen's d_z)**: roughly 0.2 small, 0.5 medium, 0.8 large.
  - Counts of people who improved, stayed the same or declined, and a **slope chart** with one
    line per person.
- **Context: all PRE vs all POST** (Welch's t-test): compares everyone, including unmatched
  responses. It's labelled *Context only* because the same people appear in both groups, so
  report the paired result as the main finding.

A dash (—) means there isn't enough data for that statistic yet. The dashboard never fills in
numbers.

### Questions: *Where awareness is strong, weak and shifting*

- **By topic**: accuracy in five areas (email phishing, links & websites, SMS & QR scams,
  impersonation, account security), PRE vs POST.
- **Item by item**: one row per scenario question:
  - PRE and POST accuracy bars and the change in percentage points (pp).
  - A label: **↑ Improved** / **↓ Declined** (change of at least 10 pp), **→ Unchanged**, or
    **Too few responses** (fewer than 5 in a stage). These labels are descriptive, **not**
    significance tests.
  - **Click a row** to see every answer option with the share choosing it, the correct option
    marked, the misconception each wrong option represents, the "not sure" rate, and paired
    detail (how many matched people went wrong→right or right→wrong, with a McNemar p-value).
- **Most common misconceptions**: the wrong beliefs chosen most often. These are great
  material for the report and for future campaign content.

### Perception: *Perceived vs demonstrated awareness*

- Average **confidence** (1–5) and its distribution, PRE vs POST.
- **Estimated vs actual** number of correct answers.
- **Calibration** = estimated − actual. Positive means people *overestimate* their ability, a
  classic finding in security awareness research.
- **ρ (rho)**: how strongly confidence relates to actual score (−1 to 1). Values near 0 mean
  confidence says little about real skill.

### Sample: *Who took part*

- Year of study, field of study, and prior training (PRE, optional), with counts and the average
  score for each group.
- **Campaign exposure (POST)**: which campaign channels people say they saw, and average scores
  for "saw at least one" vs "saw none". This is self-reported, so it's not proof of effect.
- **Missing optional answers**: how many skipped each optional question.

### Exports, Answer key, Withdrawal

See sections 7, 8 and 9. The **Answer key** tab lists every question with the correct option(s)
highlighted, the misconception behind each wrong option, and the rationale. Use it in the report
appendix. Never show it to participants.

---

## 7. Exports and using the data

The **Exports** tab downloads four files. If *Include demonstration data* is on, filenames end in
`-INCLUDING-DEMO`; don't use those for the report.

| File | Contents | Use it for |
|---|---|---|
| `hlac-responses-DATE.csv` | One row per response, every answer and score | Your own analysis in Excel, Google Sheets, SPSS or R; the data appendix |
| `hlac-items-DATE.csv` | One row per scenario question: accuracy PRE/POST, change, paired counts, McNemar p | Item-level tables in the report |
| `hlac-codebook.csv` | Every question and option ID with its full text, whether it's correct, and its misconception | Decoding the short IDs in the responses file |
| `hlac-summary-DATE.md` | A ready-written summary: sample, scores, paired results, item table, misconceptions, caveats | Starting point for the results section; opens in any text editor and pastes into Word or Google Docs |

### Columns in `hlac-responses-*.csv`

| Column | Meaning |
|---|---|
| `response_id` | Random ID of the response |
| `stage` | `pre` or `post` |
| `participant_code` | Anonymous code (empty if the POST was done without one) |
| `matched_pre_post` | `true` if the same code exists in the other stage |
| `survey_version` | Version of the questions used |
| `submitted_at` | Submission time (UTC, ISO format) |
| `duration_seconds` | Time from consent to submission |
| `knowledge_score` / `knowledge_max` / `knowledge_pct` | Score out of 10 and as a percentage |
| `items_fully_correct` | Number of scenario questions answered fully correctly |
| `confidence_1to5` | Confidence rating |
| `estimated_correct` | Self-estimated number correct |
| `calibration_estimate_minus_actual` | Positive = overestimated |
| `is_demo` | `true` only for demonstration rows |
| `d_year`, `d_field`, `d_training` | Optional demographics (PRE) |
| `s_confidence`, `s_estimate` | Raw self-assessment answers |
| `k01_…` to `k10_…` | Option chosen for each scenario (multi-select answers separated by `;`) |
| `k01_…__score` … | Score for that question (0, 1, or partial for question 4) |
| `r_exposure` | Campaign channels seen (POST) |

Look up any option ID (e.g. `k02_real_url` = `c`) in the codebook.

**Opening in Excel:** use *Data → From Text/CSV* to keep the codes and dates intact.

---

## 8. Writing up the results

Use the paired comparison as the headline and report sample sizes everywhere.

**Good phrasing**

- "Among the 28 participants who completed both surveys, the mean score rose from 5.4 to 6.5 out
  of 10 (mean change +1.1, 95% CI +0.2 to +2.0; paired t(27) = 2.4, p = .02; d_z = 0.45)."
- "The share choosing the safe response to the QR-code scenario rose from 47% to 66%."
- "Participants overestimated their performance by about 1.5 questions before the campaign."

**Avoid**

- "The campaign *caused* / *proved* an improvement." There is no control group. Seeing the same
  questions twice, talking to each other, or news events could also explain changes.
- "No effect" when p > .05. With about 30 people the study can easily miss real changes, so
  report the confidence interval instead.
- Reporting any figure while *Include demonstration data* is on.

The *Interpretation caveats* at the end of the summary export are written to paste into the
limitations section. The methodology (question design, scoring, statistics) is in
[SURVEY_DESIGN.md](SURVEY_DESIGN.md).

---

## 9. Participant support: lost codes and withdrawals

**"I lost my code."** We can't look it up, because nothing links a code to a person; that's the
point. They can still take the POST survey by choosing *I don't have my code*. Their answers count
in the overall results but not in the paired comparison. If they saved the file or a screenshot,
the code is in there.

**"It says my code is wrong."** Codes are 8 characters: digits and capital letters, never I, L, O
or U (if typed, those are read as 1 or 0 automatically). A typo is caught instantly. Ask them to re-check
their screenshot.

**"It says already recorded."** A POST response has already been submitted with that code.
Nothing more to do. If they believe someone else used their code, handle it as a withdrawal
(below) and ask them to retake POST.

**"I want my answers deleted."** (Their right under the consent notice.)

1. Ask them to email their **code** to the team contact address.
2. Open the dashboard → **Withdrawal** tab.
3. Enter the code, then confirm.
4. The dashboard reports how many responses and sessions were deleted. This is **permanent**.
5. Reply to confirm. Don't keep the code anywhere afterwards.

---

## 10. Demonstration data

To preview the dashboard with realistic-looking numbers before real data exists, a maintainer can
run:

```bash
npm run db:seed-demo
```

This adds about 68 **fake** responses, flagged as demo.

- They're **hidden by default**. Turn on *Include demonstration data* in the dashboard to see
  them.
- While it's on, an orange **DEMONSTRATION DATA — not real participants** banner shows on every
  tab.
- Exports made with it on are clearly named and labelled.

Remove them all before collecting real data (real responses are untouched):

```bash
npm run db:purge-demo
```

**Never** put demo numbers in the report or presentation.

---

## 11. Editing the survey (maintainer)

All questions live in **`server/survey/definition.ts`**: wording, options, which stage shows them,
correct answers, misconception labels and rationale. The website and dashboard update
automatically.

- **Study details** (team, contact email, retention): `web/src/studyInfo.ts`.
- **Campaign channels** in the POST exposure question: edit the `options` of the question with
  `id: "r_exposure"`, e.g. add `{ id: "tiktok", label: "TikTok videos" }`.
- After editing, run `npm test` to check the answer key is still consistent.

> ⚠️ **Once real data collection has started, don't change question meaning or option IDs.**
> PRE and POST must use identical questions to be comparable. If a change is unavoidable,
> increase `SURVEY_VERSION` in the same file; the dashboard then flags responses from the older
> version.

---

## 12. Deploying online (maintainer)

Participants need a public address. Any host with **Node 22** and a **persistent disk** works.
Example with [Render](https://render.com):

1. Sign in to Render with GitHub and choose **New → Web Service**, then select the `HumanFactor`
   repository.
2. Settings:
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
3. Add a **Disk** (1 GB is plenty) with **mount path** `/var/data`.
4. Under **Environment**, add:

   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `DATABASE_PATH` | `/var/data/hlac.db` |
   | `ADMIN_PASSWORD` | a strong team password (≥ 12 characters, not the example) |
   | `SESSION_SECRET` | a 64-character random string (command in section 2) |
   | `TRUST_PROXY` | `true` |

5. Deploy. Open `https://<your-app>.onrender.com/team` and sign in to check it works.

> **The disk is essential.** Without it, all responses are erased every time the service
> restarts or redeploys.

The server refuses to start in production if the password or secret is missing, too short, or
still the example value. Check the host's logs if a deploy fails.

---

## 13. Backups and resetting (maintainer)

- **Easiest backup:** download `hlac-responses-*.csv` from the dashboard regularly, e.g. daily
  during collection.
- **Full backup:** the entire dataset is one file (`DATABASE_PATH`). Copy it while the server is
  stopped, or live with:
  ```bash
  sqlite3 data/hlac.db ".backup backup-$(date +%F).db"
  ```
- **Wipe all data** (e.g. after your test run, or at the end of the retention period): stop the
  server, delete the database file **and** its `-wal` / `-shm` companions if present, then run
  `npm run db:init` and start again. **This is irreversible**, so back up first if unsure.

---

## 14. Privacy and security: team responsibilities

The platform is built to collect as little as possible. Please keep it that way:

- **Never** add questions asking for names, emails, student IDs or phone numbers.
- Keep the **dashboard password private**. Share it one-to-one, not in group chats, posts or
  GitHub. If it leaks, change `ADMIN_PASSWORD` and `SESSION_SECRET` and restart, which signs
  everyone out.
- Don't commit `.env` or database files (they're excluded automatically; don't force them in).
- Report results **only as group statistics**. Don't publish participant codes or the
  response-level CSV.
- Store downloaded exports in the team's private storage, and delete them when the retention
  period ends.
- Honour withdrawal requests promptly (section 9).

---

## 15. Troubleshooting

| Problem | Cause and fix |
|---|---|
| *"We couldn't reach the server"* after clicking **I agree** | The page is open but the server isn't running. Locally, start `npm run dev` and keep the terminal open. Online, check the host's dashboard. |
| *"This project needs Node.js 22 or newer"* | Run `nvm use` (or install Node 22), then `npm install`. |
| Crash or "Segmentation fault" on start | Old Node version. Same fix: Node 22, then `npm install`. |
| Dashboard login says the dashboard is disabled | `ADMIN_PASSWORD` isn't set. Add it to `.env` (or the host settings) and restart. |
| *"That password isn't correct"* | Check `ADMIN_PASSWORD` in `.env`. After changing it, restart the server. |
| *"Too many attempts"* | 10 failed logins. Wait 15 minutes. |
| Dashboard keeps signing me out | Sessions last 8 hours. Changing `SESSION_SECRET` or (locally) restarting without one signs everyone out. |
| All responses disappeared after a redeploy | The host has no persistent disk, or `DATABASE_PATH` doesn't point to it (section 12). |
| Numbers look too good / there are ~68 responses we didn't collect | *Include demonstration data* is on, or demo data was never purged (section 10). |
| Participants see "Too many requests" | Very unusual; limits are 1,000 per 15 minutes per network. Make sure `TRUST_PROXY=true` is set on the host. |
| Port already in use | Another copy is running. Close it, or stop whatever uses port 3000 or 5173. |

---

## 16. FAQ

**Can participants see their score or the right answers?** No, never; that would affect the POST
results. The thank-you screen gives one general safety tip.

**Can someone take the survey twice?** One POST per code is enforced. The same device shows an
"already completed" notice. Someone determined could retake PRE in another browser; with no
identity collected, that can't be fully prevented. Mention it as a limitation.

**Do participants need an account?** No. Just the link.

**How long are dashboard numbers delayed?** At most 15 seconds, or click *Refresh*.

**Can several teammates use the dashboard at once?** Yes, all with the same password.

**Is it OK on phones?** Yes. Both the survey and the dashboard work on phones.

**Where's the scoring explained?** [SURVEY_DESIGN.md](SURVEY_DESIGN.md#scoring). In short: 1 point
per scenario, partial credit on the multi-select question, "I'm not sure" = 0, recorded
separately.

---

## 17. Command reference

Run these in the project folder, with Node 22 active (`nvm use`).

| Command | What it does |
|---|---|
| `npm install` | Install dependencies (once, and after pulling updates) |
| `npm run dev` | Run locally: site at <http://localhost:5173>, API on port 3000 |
| `npm run build` | Check and build the production website |
| `npm start` | Run the production server (after `npm run build`) |
| `npm test` | Run the automated tests |
| `npm run db:init` | Create the database or apply updates |
| `npm run db:seed-demo` | Add flagged demonstration data |
| `npm run db:purge-demo` | Remove all demonstration data |
| `git pull` | Get the latest version from GitHub |
