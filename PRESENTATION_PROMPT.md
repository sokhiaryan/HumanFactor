# Prompt: HLAC class presentation deck

Copy everything below the line into your deck generator (Claude, Gamma, Copilot, etc.).
Attach the images listed in "Files to attach" so they can be placed on slides.

---

You are an experienced presentation designer and security-awareness educator. Build a
**15–16 slide PowerPoint deck** for a **15–20 minute university group presentation**. It should
tell one clear story, start with motivation, and end with lessons learned and recommendations.
Write speaker notes for every slide: about 60–90 seconds of natural spoken text, plus who on the
team presents it (use "Presenter A/B/C/D" placeholders).

## 1. The assignment (what the deck is graded on)

Course: Human-Centred Security Awareness (HLAC). The assignment is "Design and Evaluate a
Security Awareness Program". Groups of 2–4 students must:

- design an awareness program on a security topic for a chosen audience, with engaging content
  (posters, videos, quizzes, presentations), supporting materials, delivery channels and a
  deployment timeline;
- use **at least one social media channel**: create posts, stories or infographics, plan a
  posting schedule, follow platform best practices (hashtags, timing, visuals), and use
  analytics (likes, shares, comments, reach) where possible;
- run the program with a sample of the audience (**30+ participants recommended**), collect
  **baseline (pre) data**, deliver the program, then collect **post data** with a similar
  survey or quiz;
- follow ethics: **informed consent, anonymised data, accessibility and inclusivity**;
- present design, implementation, evaluation results, challenges, successes, lessons learned
  and recommendations in **15–20 minutes**.

Grading:
1. **Program design:** creativity, relevance, clarity, quality of materials.
2. **Implementation and data collection:** effective delivery, data completeness, ethical
   conduct.
3. **Report and presentation:** analysis quality, insight, communication.

Make sure every grading criterion is visibly covered by at least one slide.

## 2. Our program

**Topic:** phishing and social engineering, plus password hygiene. These are the attacks
students actually meet: fake account-suspension emails, parcel-fee texts, "send me the code"
messages, OTP scams, QR stickers and reused passwords.

**Audience:** university students aged 18+.

**Three named parts (keep the names consistent throughout the deck):**

| Name | What it is |
|---|---|
| **ClickWise**, tagline "Think. Check. Stay safe." | The campaign brand, used on the posters and infographics |
| **cyber.decoded_** | The campaign's Instagram account. Bio: "Think. Check. Stay safe. Spot scams before they spot you. Passwords · Phishing · Online Safety. Student-led awareness campaign" |
| **HumanFactor** | The web platform we built to measure the campaign: an anonymous PRE/POST survey and an analytics dashboard |

### Campaign content we produced (attached images)

**Instagram, @cyber.decoded_: 5 posts, carousels with music**
1. **"Your password isn't as safe as you think."** An 8-slide carousel, "Cyber Aware // Vol. 02".
   Slide 2: "One password. All your accounts. One big risk." It shows email, social, shopping
   and banking accounts linked to one key ("If attackers get one reused password, they can try
   it on your other accounts too").
2. **"Don't get hooked. Think before you click."** An SMS phishing visual: a phone showing a
   suspicious link with a fish hook.
3. **"Verify before you click."** A decision flowchart for scary Instagram messages: don't click
   the link → open the Instagram app manually → if there's an alert in the app, follow the
   in-app recovery steps; if there isn't, delete and report the message.
4. **"16 billion credentials exposed."** A data-breach awareness post.
5. **"Think before you click!"** An email phishing post. Caption: "That email might not be what
   it seems…"

**ClickWise posters and infographics (a 4-part series)**
- **"A stronger password, a stronger you."** Weak passwords (ananya123, password, 123456)
  compared with a strong one. Tips: a unique password per account, avoid personal information,
  use a password manager, enable MFA. Closing line: "Small habits, big security."
- **"It looks real. But is it?"** A fake "University Support" email ("Your account will be
  suspended in 24 hours… Verify Now") sent from a look-alike domain. Watch out for urgent
  language, suspicious links, unexpected attachments, and requests for personal information.
  Closing line: "When in doubt, don't click. Verify."
- **3/4: "They only need the OTP. That's all it takes."** A scam call that says "calling from
  your bank, share the OTP". Banks never ask for your OTP, so don't share it even if the caller
  sounds official.
- **4/4: "Spotted something suspicious? Here's what to do."** Stop → Secure (change the
  password, enable 2FA) → Report (college IT or the platform) → Stay alert.

**Social media metrics, stated honestly:** the Instagram account is new. At the time of the
screenshots it had **5 posts, 2 followers and about 1 like per post**, with posts 9–11 hours
old. **Do not inflate these numbers.** Present them as an early baseline. Use the low reach as
a real lesson learned on the challenges slide, then give concrete fixes: cross-post to class
group chats and stories, use relevant hashtags, post at peak times for students, run polls or
quiz stickers, and ask society or department accounts to share.

### The measurement platform: HumanFactor

- **Survey:** 10 scored scenario questions, the same at PRE and POST, with option order
  shuffled for each participant. Scenarios:
  1. account-suspension email;
  2. reading a URL;
  3. what the padlock means;
  4. phishing warning signs;
  5. parcel-fee SMS;
  6. unexpected sign-in approvals (MFA fatigue);
  7. a friend asking for a code;
  8. a lecturer's gift-card request;
  9. a QR code on a parking meter;
  10. what to do after entering a password.
- **Also measured:** confidence (1–5), asked *before* the scenarios, and a self-estimated score,
  asked *after*. Optional coarse demographics. Campaign exposure (POST only).
- **Length:** PRE has 15 questions (about 7 minutes) and POST has 13 (about 6 minutes).
- **Scoring:** 1 point per item. The multi-select item gets partial credit. "I'm not sure"
  scores 0 but is tracked separately from wrong answers, so uncertainty can be told apart from
  misconceptions. Every wrong option maps to a named misconception, for example "believes the
  padlock means a site is safe".
- **Anonymous matching:** a random code is issued at PRE and re-entered at POST. No names,
  emails, student IDs or IP addresses are collected.
- **Ethics built in:**
  - consent and an 18+ confirmation before any question;
  - voluntary, with the option to withdraw by code;
  - no correct answers shown, so the PRE survey doesn't teach;
  - a password-protected team dashboard;
  - group-level reporting only.
- **Accessibility:** keyboard navigable, screen-reader labels, WCAG contrast, mobile-first,
  reduced-motion support, and plain-language copy.
- **Dashboard and analysis:**
  - completion and score distributions;
  - a paired PRE→POST comparison (paired t-test, Wilcoxon, Cohen's d_z, 95% CI);
  - item and topic accuracy, and the most common misconceptions;
  - perceived vs demonstrated awareness (calibration);
  - exposure breakdown;
  - CSV and summary exports.
- **Quality:**
  - 63 automated tests pass;
  - the statistics are checked against R reference values;
  - an independent verifier recomputes 184 dashboard figures from the raw database and all
    184 match.
- **Code:** https://github.com/sokhiaryan/HumanFactor

### Evaluation results

The platform has not yet been run with live participants. The figures below come from a
**modelled demonstration dataset of 115 responses**. They show the analysis the final report
will contain. **Label them on the slides as "Demonstration of our analysis pipeline: live
results to follow."** Do not present them as findings.

- **Sample:** 64 PRE and 51 POST responses (91% and 94% completion), with **42 matched pairs**.
- **Paired result:** mean score **6.30 → 7.48 out of 10**, change **+1.18** (95% CI +0.61 to
  +1.75), t(41) = 4.19, p < .001, d_z = 0.65. 31 improved, 5 unchanged, 6 declined.
- **Largest topic gains:**
  - links and websites: 43% → 63%;
  - impersonation: 67% → 86%;
  - padlock item: +23 pp;
  - "friend asks for a code" item: +20 pp.
- **Top misconceptions at baseline:**
  - 31% believe the padlock means a site is safe;
  - 25% don't see unexpected sign-in prompts as a sign their password is known;
  - 17% read the brand at the start of a URL as the real domain.
- **Calibration:** people overestimate their score by **+1.44** questions at PRE and **+0.43**
  at POST. The correlation between confidence and score rises from ρ = 0.15 to 0.41.
- **Caveat to state on the slide:** this is observed change, not proof of cause. There is no
  control group, the questions are repeated, and both self-selection and discussion between
  participants could contribute.

## 3. Required story and slide flow

Use this arc: **hook → problem → audience → solution → content → measurement → results →
reflection → call to action.**

1. **Title:** "ClickWise: Think. Check. Stay safe." Subtitle: "A student phishing and password
   awareness campaign, measured with HumanFactor." Include the group members and course.
2. **Hook:** open with a question for the room, for example "Who's had a 'your parcel is held'
   text this month?" Show the fake University Support email and ask: real or phish?
3. **Why it matters:** humans are the main target (social engineering and credential reuse),
   with the "16 billion credentials exposed" post as the visual. Use only statistics that come
   from a reputable source, cited on the slide. If you can't cite one, describe the risk
   qualitatively.
4. **Audience and goals:** why students (new accounts, university logins, shared links, OTP
   scams), and three learning goals: spot it, verify it, report it.
5. **Program design overview:** a diagram of ClickWise (content) + @cyber.decoded_ (channel) +
   HumanFactor (measurement), and how they connect.
6. **Content showcase 1, posters:** the four ClickWise pieces as a gallery. Note the design
   choices: one message per piece, concrete actions, friendly hand-drawn style.
7. **Content showcase 2, Instagram:** the profile grid plus the carousel and flowchart posts.
   Cover platform best practices: carousels, music, strong hooks, swipe prompts.
8. **Delivery channels and timeline:** Week 0 PRE survey → Weeks 1–2 posts and posters (give a
   posting schedule, e.g. 3 posts a week, evenings) → Week 3 POST survey → Week 4 analysis and
   report. Mark this as the plan.
9. **Measurement design:** PRE/POST with the same scenarios, anonymous code matching, and
   knowledge measured separately from confidence. Show one example scenario question.
10. **Ethics and accessibility:** consent, 18+, anonymity, withdrawal, group-level reporting,
    no feedback during PRE, accessibility features.
11. **HumanFactor platform:** screenshots of the survey and dashboard, plus the quality points
    (tests, 184-figure verifier).
12. **Results, paired change:** the slope or before/after chart, with the demonstration label
    and caveat.
13. **Results, where people go wrong:** a misconceptions chart, linked back to the content that
    targets each one (padlock → "It looks real" poster; OTP → poster 3/4).
14. **Results, confidence gap:** calibration. People think they're better than they are, which
    is the core argument for awareness training.
15. **Challenges and lessons learned:**
    - low early Instagram reach (2 followers);
    - reaching 30+ participants;
    - keeping the survey anonymous yet matchable;
    - avoiding the PRE survey teaching the answers;
    - getting ethics approval before launch.
16. **Recommendations and next steps:**
    - grow reach (cross-posting, collaborations, polls);
    - run the live PRE/POST with 30+ students;
    - add a simulated-phishing test if ethics allows;
    - add a control group;
    - do a follow-up after 4–6 weeks to measure retention.
    End with a call to action: "Think. Check. Stay safe." and a QR code placeholder for the
    survey.

Add a short appendix slide with references and the GitHub link if there's room.

## 4. Design direction

- Match the campaign's look: a dark navy or near-black base, with coral-red, mint-green and
  cream "sticky note" accents from the ClickWise posters, and a clean bold sans-serif for
  headings.
- One idea per slide, a 6-word headline maximum, at most 3 short bullets, and large visuals.
- Charts should have direct labels and no 3D. Label PRE and POST by text as well as colour.
- Put the campaign images in phone or poster frames. Don't crop out their text.
- Accessibility: 24pt+ body text, high contrast, and alt text on every image.

## 5. Rules

- Do not invent participant numbers, engagement metrics or statistics beyond what is given
  here.
- Keep the demonstration label on the results slides.
- Keep the brand names consistent: ClickWise, @cyber.decoded_, HumanFactor.
- Output a .pptx with speaker notes.

## Files to attach

- Instagram: `Image.jpeg` (profile grid), `Image (1).jpeg` (Think before you click),
  `Image (2).jpeg` (Don't get hooked), `Image (3).jpeg` and `Image (4).jpeg` (password
  carousel, slides 1–2)
- ClickWise posters: `Image (5).jpeg` (strong password), `Image (6).jpeg` (It looks real),
  `Image (8).jpeg` (OTP, 3/4), `Image (7).jpeg` (what to do, 4/4)
- HumanFactor screenshots from the repo, `docs/audit/screenshots/`:
  - `01`–`09b` for the survey flow;
  - `10-dashboard-overview.jpg`, `11-dashboard-distribution.jpg`, `12-dashboard-questions.jpg`,
    `13-dashboard-paired.jpg` and `14-dashboard-perception.jpg` for the results slides.
