# Survey design, scoring and analysis

This document explains *why* the assessment looks the way it does. Use it for the
methodology section of the report. The questions themselves live in
[`server/survey/definition.ts`](../server/survey/definition.ts) (the single source of truth,
including the answer key and misconception labels). The **Answer key** tab of the team
dashboard and the codebook export (`codebook.csv`) show the same information.

## Topic

**Phishing and social engineering.** It is the most common way students are actually attacked
(account-suspension emails, parcel-fee texts, "send me the code" messages, QR stickers). It also
lends itself to *scenario* questions with one defensible best action, so knowledge can be
measured objectively instead of asking people how security-conscious they feel.

## Structure

| Block | PRE | POST | Scored | Purpose |
|---|---|---|---|---|
| About you (3 items: year, field, prior training) | ✓ (optional) | — | No | Describe the sample; check whether computing students or previously trained students start from a different baseline. Coarse categories plus "Prefer not to say", so no one can be identified. |
| Confidence (1 item, 1–5) | ✓ | ✓ | No | *Perceived* awareness. Asked **before** the scenarios so the rating isn't coloured by how hard the questions felt. |
| Scenarios (10 items) | ✓ | ✓ | **Yes** | *Demonstrated* knowledge and decision-making. |
| Self-estimate (0–10) | ✓ | ✓ | No | Calibration: estimated vs actual number correct. |
| Campaign exposure (multi-select) | — | ✓ | No | Which parts of the campaign each person saw; the team should edit the options to match its real channels. |

PRE has 15 questions (~7 min) and POST has 13 (~6 min), inside the 10–15 target.

## The ten scenario items

| # | Item | Topic | What it tests | Typical misconceptions captured |
|---|---|---|---|---|
| 1 | Account-suspension email | Email phishing | Verifying through a trusted channel instead of the link | "Looks official = safe"; asking the sender to verify itself; trusting spam filters |
| 2 | Reading a URL | Links & websites | Identifying the real domain (`login.northbridge.com` vs `northbridge.com.account-verify.net`) | Reading left-to-right; brand-in-domain = legitimate; look-alike endings |
| 3 | What the padlock means | Links & websites | HTTPS = encryption, not legitimacy | "Padlock = safe / verified owner / can't be phished" |
| 4 | Phishing warning signs (multi-select) | Email phishing | Recognising four real indicators among two irrelevant ones | Treating send time or logos as meaningful |
| 5 | Parcel-fee text (smishing) | SMS & QR scams | Checking via the official app | "Small fee = low risk"; "opening a link is harmless"; replying STOP |
| 6 | Unexpected sign-in approvals + IT call | Account security | MFA-fatigue/vishing response | Authority compliance; approving to stop prompts; not realising the password is already compromised |
| 7 | Friend asks for a verification code | Impersonation | Account-takeover via a hijacked contact | Trusting familiar contacts; "codes expire so it's fine" |
| 8 | Lecturer gift-card request | Impersonation | Pretexting / authority fraud | Authority compliance; engaging; partial compliance |
| 9 | QR sticker on a parking meter | SMS & QR scams | QR-code phishing | Trusting placement; padlock = safe (consistency check with item 3); camera app = safe |
| 10 | After entering a password on a fake page | Account security | Incident response | Passive waiting; antivirus fixes it; over-reliance on 2FA |

Design rules applied to every item:

- **Realistic, student-relevant stimuli.** Emails, texts, DMs, lock-screen notifications and a
  sticker are rendered as mock-ups. All names, numbers and domains are fictional; the phone number
  uses the reserved 555-01xx range.
- **One defensible best answer** for single-choice items. Distractors are plausible actions real
  people take, each mapped to a named misconception, so wrong answers are diagnostic rather than
  just "wrong".
- **Balanced option lengths.** The correct option is not systematically the longest, which
  reduces test-wise guessing.
- **"I'm not sure" on every item.** It scores 0 but is recorded separately as *unsure*, so the
  analysis can tell a **misconception** (a confident wrong belief) from **uncertainty** (not knowing).
- **Plain language, no jargon.** Terms like "MFA fatigue", "smishing" or "pretexting" never
  appear in the questions.
- **No leading cues.** Prompts ask "what should you do?" rather than "is this a scam?".

## Pre/post equivalence

The ten scenario items are **identical** in both stages, with the same wording, options and
scoring. This is the most defensible way to compare scores when parallel forms can't be
validated on a sample of ~30. To reduce memory of answer *positions*, option order is shuffled per
participant (seeded by their session, so a refresh doesn't reshuffle). "I'm not sure" always stays
last. The trade-off is a possible **testing effect** (people improve partly because they have seen
the items before), which the dashboard and summary list as a caveat.

Participants never see correct answers or their score, neither after PRE nor after POST. Showing
feedback after PRE would itself be an intervention and would contaminate the POST measure.

## Anonymous matching

At PRE the server generates a random 8-character code (`K7QM-3XP9`: 7 random characters from a
32-letter alphabet without I/L/O/U, plus a check character). Participants save it by screenshot,
copying or downloading it, and enter it at POST.

- The check character rejects any single mistyped character and most swapped neighbours *before*
  submission, so typos don't create false non-matches.
- Lower case, spaces, dashes and look-alikes (O→0, I/L→1) are normalised.
- One response per code per stage is enforced by a database constraint. POST without a code is
  allowed and counted, but excluded from paired analysis.
- The code is not derived from anything personal, and the server stores no names, emails, IPs or
  device identifiers. Withdrawal works by the participant sending the team their code.

## Scoring

| Item type | Rule |
|---|---|
| Single-choice (9 items) | 1 point for the correct option, otherwise 0. |
| Multi-select warning signs (item 4) | Partial credit: **max(0, (correct picks − incorrect picks) / 4)**. Selecting all six options scores 0.5, so "tick everything" is penalised. |
| "I'm not sure" | 0 points, outcome recorded as `unsure`. |
| Confidence, estimate, demographics, exposure | Not scored. |

**Knowledge score** = the sum over the 10 items (0–10, may include .25 steps from item 4).
**Item accuracy** = mean item score, which for single-choice items is the proportion correct.
**Calibration** = self-estimated number correct − number of items fully correct (positive means
over-confident).

Scoring happens only on the server, and the participant never receives the score.

## Analysis provided by the dashboard

- **Descriptives** per stage: n, mean with 95% t-interval, median, IQR, SD, range and histogram.
- **Paired comparison** (matched codes, the primary analysis): mean change with 95% CI; paired
  t-test; Wilcoxon signed-rank (normal approximation, continuity- and tie-corrected) as a check
  that doesn't assume normality; Cohen's d_z; counts improved / unchanged / declined; slope chart.
- **Independent-groups context**: Welch's t-test and Cohen's d on all PRE vs all POST. This is
  clearly labelled as context only, because the groups overlap.
- **Items**: accuracy per stage, change in percentage points, a descriptive "improved / unchanged /
  declined" label (≥ 10 pp change with ≥ 5 responses per stage; this is *not* a significance
  test), paired transitions and exact McNemar p (exploratory, uncorrected for 10 comparisons),
  option distributions and top misconceptions.
- **Perception vs knowledge**: confidence distributions, Spearman ρ(confidence, score), and
  calibration.
- **Sample**: demographics with mean score per group, campaign exposure, and mean POST score and
  paired change by exposure (self-reported and non-randomised, so explicitly not causal).
- **Data quality**: sample-size warnings against the brief's 30-participant target, abandoned
  sessions, unmatched POSTs, missing optional answers, and older survey versions.

### What you can and cannot claim

- ✅ "Among the *n* participants who completed both surveys, the mean score changed from X to Y
  (mean change Z, 95% CI …)."
- ✅ "The share of participants choosing the safe option for QR codes rose from A% to B%."
- ❌ "The campaign caused a Z-point improvement." There is no control group. Repeated testing,
  peer discussion, outside events and self-selection could all contribute.
- ❌ Reading a non-significant p-value as "no effect". With n ≈ 30 the study has limited power,
  so report the confidence interval instead.

The statistics routines are tested against reference values from R (`tests/stats.test.ts`).
