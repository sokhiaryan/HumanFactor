// The HumanFactor phishing & social-engineering assessment (HLAC course project).
//
// This file is the single source of truth for the survey: wording, order, which stage
// shows each question, and the server-only answer key. The browser only ever receives
// the output of `publicSurvey()` (see ./public.ts), which strips every `key` field.
//
// Editing guidance
// - Never change the meaning of a question or its option ids once data collection has
//   started; bump SURVEY_VERSION if you must, so responses stay comparable.
// - Knowledge items appear in BOTH stages with identical wording so PRE and POST scores
//   are directly comparable. Option order is shuffled per participant to blunt
//   position memory between the two sittings.

import type { Option, PublicQuestion, Stage } from "../../shared/types.js";

export const SURVEY_VERSION = "2026.1";
export const SURVEY_TITLE = "HumanFactor";
export const SURVEY_TOPIC = "Phishing & social engineering";
export const ESTIMATED_MINUTES: Record<Stage, number> = { pre: 7, post: 6 };

export const UNSURE: Option = { id: "unsure", label: "I'm not sure", exclusive: true };

export const TOPICS = {
  email: "Email phishing",
  links: "Links & websites",
  mobile: "SMS & QR scams",
  impersonation: "Impersonation & pretexting",
  account: "Account security & response",
} as const;
export type Topic = keyof typeof TOPICS;

export interface AnswerKey {
  topic: Topic;
  /** Option ids that are correct. Single-choice items have exactly one. */
  correct: string[];
  /** Misconception that choosing each wrong option reveals (option id → label). */
  misconceptions: Record<string, string>;
  /** Why the correct answer is correct. Shown only in the team dashboard. */
  rationale: string;
}

export interface QuestionDefinition extends PublicQuestion {
  stages: Stage[];
  /** Short label for charts and CSV column headers. */
  shortLabel: string;
  /** Present only on scored knowledge items. Never sent to participants. */
  key?: AnswerKey;
}

const BOTH: Stage[] = ["pre", "post"];
const PREFER_NOT: Option = { id: "prefer_not", label: "Prefer not to say", exclusive: true };

export const QUESTIONS: QuestionDefinition[] = [
  // -------------------------------------------------------------------------
  // About you (PRE only, optional). Kept to three coarse, non-identifying items
  // that plausibly moderate awareness: study year, field, and prior training.
  // -------------------------------------------------------------------------
  {
    id: "d_year",
    shortLabel: "Year of study",
    kind: "single",
    section: "about",
    stages: ["pre"],
    required: false,
    prompt: "Which year of study are you in?",
    help: "Optional. Used only to describe the sample as a group.",
    options: [
      { id: "y1", label: "First year" },
      { id: "y2", label: "Second year" },
      { id: "y3", label: "Third year" },
      { id: "y4", label: "Fourth year or above" },
      { id: "pg", label: "Postgraduate" },
      { id: "other", label: "Not currently a student / other" },
      PREFER_NOT,
    ],
  },
  {
    id: "d_field",
    shortLabel: "Field of study",
    kind: "single",
    section: "about",
    stages: ["pre"],
    required: false,
    prompt: "Which best describes your field of study?",
    help: "Optional. Lets us check whether computing students start from a different baseline.",
    options: [
      { id: "computing", label: "Computing, IT or cybersecurity" },
      { id: "stem", label: "Other science, engineering or maths" },
      { id: "business", label: "Business, economics or management" },
      { id: "humanities", label: "Arts, humanities or social sciences" },
      { id: "health", label: "Health or life sciences" },
      { id: "other", label: "Something else" },
      PREFER_NOT,
    ],
  },
  {
    id: "d_training",
    shortLabel: "Prior training",
    kind: "single",
    section: "about",
    stages: ["pre"],
    required: false,
    prompt: "Have you had any cybersecurity awareness training before?",
    help: "For example a workshop, a course module, or training at a job.",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
      { id: "unsure", label: "I'm not sure" },
      PREFER_NOT,
    ],
  },

  // -------------------------------------------------------------------------
  // Perceived awareness (both stages). Asked BEFORE the scenarios so the rating
  // is not influenced by how hard the questions felt.
  // -------------------------------------------------------------------------
  {
    id: "s_confidence",
    shortLabel: "Confidence",
    kind: "likert",
    section: "self",
    stages: BOTH,
    required: true,
    prompt: "How confident are you that you could recognise a phishing or scam message if you received one today?",
    scale: {
      min: 1,
      max: 5,
      minLabel: "Not at all confident",
      maxLabel: "Extremely confident",
      labels: ["Not at all", "Slightly", "Moderately", "Very", "Extremely"],
    },
  },

  // -------------------------------------------------------------------------
  // Knowledge & decision-making (both stages, scored). Realistic scenarios; each
  // wrong option maps to a specific misconception; every item offers "I'm not sure"
  // so guessing can be separated from genuine misconceptions.
  // -------------------------------------------------------------------------
  {
    id: "k01_account_email",
    shortLabel: "Account-suspension email",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt: "You get this email on your phone between classes. What is the best thing to do?",
    stimulus: {
      type: "email",
      fromName: "University IT Service Desk",
      fromAddress: "it-support@univ-helpdesk-portal.com",
      subject: "Action required: your student account will be suspended",
      body: [
        "We detected unusual sign-in activity on your student account.",
        "To avoid suspension, please verify your account within 24 hours.",
      ],
      cta: "Verify my account",
    },
    options: [
      { id: "a", label: "Tap “Verify my account” and sign in — if the login page looks official, it's safe." },
      { id: "b", label: "Reply to the email and ask the IT team to confirm it's genuine." },
      { id: "c", label: "Skip the button, sign in through the portal you normally use, and report the email." },
      { id: "d", label: "Leave it — anything dangerous would have been caught by the spam filter." },
      UNSURE,
    ],
    key: {
      topic: "email",
      correct: ["c"],
      misconceptions: {
        a: "Judges safety by how official a page looks",
        b: "Asks the (possibly fake) sender to verify itself",
        d: "Assumes spam filters catch every phish",
      },
      rationale:
        "The sender domain is not the university's and the message uses urgency. Checking via a channel you already trust avoids the link entirely; reporting helps IT warn others.",
    },
  },
  {
    id: "k02_real_url",
    shortLabel: "Reading a URL",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt:
      "Your bank, Northbridge Bank, uses the website northbridge.com. Which link would actually take you to a page on Northbridge's own website?",
    options: [
      { id: "a", label: "https://northbridge.com.account-verify.net/login", mono: true },
      { id: "b", label: "https://secure-northbridge.com/login", mono: true },
      { id: "c", label: "https://login.northbridge.com/account", mono: true },
      { id: "d", label: "https://northbridge-com.support/login", mono: true },
      UNSURE,
    ],
    key: {
      topic: "links",
      correct: ["c"],
      misconceptions: {
        a: "Reads the brand at the start of the address as the real domain",
        b: "Trusts any domain that contains the brand name",
        d: "Misses look-alike domains with a different ending",
      },
      rationale:
        "The real domain is the part immediately before the first single “/”. Only login.northbridge.com ends in northbridge.com; the others belong to account-verify.net, secure-northbridge.com and northbridge-com.support.",
    },
  },
  {
    id: "k03_padlock",
    shortLabel: "What the padlock means",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt: "A website address starts with https:// and your browser shows a padlock icon. What does that tell you?",
    options: [
      { id: "a", label: "The site has been checked and confirmed to be safe." },
      { id: "b", label: "The connection is encrypted, but the site could still be fake." },
      { id: "c", label: "The site belongs to a registered, legitimate organisation." },
      { id: "d", label: "Passwords you type on the site cannot be stolen." },
      UNSURE,
    ],
    key: {
      topic: "links",
      correct: ["b"],
      misconceptions: {
        a: "Believes the padlock means a site is safe",
        c: "Believes the padlock proves who owns the site",
        d: "Believes encryption prevents credential phishing",
      },
      rationale:
        "HTTPS only protects data in transit. Certificates are free and automatic, so most phishing sites now show a padlock too.",
    },
  },
  {
    id: "k04_warning_signs",
    shortLabel: "Phishing warning signs",
    kind: "multi",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt: "Which of these are common warning signs that a message may be phishing?",
    help: "Select all that apply.",
    options: [
      { id: "urgency", label: "Pressure to act fast, or a threat of consequences" },
      { id: "mismatch", label: "The sender's display name doesn't match their email address" },
      { id: "credentials", label: "A link asking you to enter your password or card details" },
      { id: "attachment", label: "An unexpected attachment that asks you to “enable content”" },
      { id: "hours", label: "It was sent during normal business hours" },
      { id: "logo", label: "It shows the organisation's official logo and colours" },
      UNSURE,
    ],
    key: {
      topic: "email",
      correct: ["urgency", "mismatch", "credentials", "attachment"],
      misconceptions: {
        hours: "Treats irrelevant details as red flags",
        logo: "Treats irrelevant details as red flags",
      },
      rationale:
        "Urgency, sender mismatch, credential requests and macro-enabled attachments are classic indicators. Send time and logos tell you nothing — logos are trivially copied.",
    },
  },
  {
    id: "k05_parcel_sms",
    shortLabel: "Parcel-fee text message",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt: "You are expecting a parcel this week and receive this text. What should you do?",
    stimulus: {
      type: "sms",
      sender: "+1 (555) 014-2290",
      body: "ParcelPoint: your package is on hold due to an unpaid redelivery fee of $1.99. Pay now to avoid return: parcelpoint-redelivery.info/pay",
    },
    options: [
      { id: "a", label: "Pay the fee — it's a tiny amount, so there's little to lose." },
      { id: "b", label: "Open the link to see the tracking page, but don't enter card details." },
      { id: "c", label: "Check the delivery in the courier's official app or website instead." },
      { id: "d", label: "Reply STOP so the sender removes your number." },
      UNSURE,
    ],
    key: {
      topic: "mobile",
      correct: ["c"],
      misconceptions: {
        a: "Thinks a small payment means low risk",
        b: "Thinks opening a link is harmless if you don't type anything",
        d: "Engages with the scammer (confirms the number is active)",
      },
      rationale:
        "Small fees are bait to harvest full card details. Visiting the link confirms interest and can expose you to malicious pages; replying confirms your number is live.",
    },
  },
  {
    id: "k06_mfa_fatigue",
    shortLabel: "Unexpected sign-in approvals",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt:
      "Late at night your phone shows several sign-in requests you didn't start. Minutes later, a caller saying they're from IT asks you to tap “Approve” to fix a sync error. What should you do?",
    stimulus: {
      type: "notification",
      app: "Authenticator",
      title: "Approve sign-in?",
      body: "Student account · Location unknown",
      count: 4,
    },
    options: [
      { id: "a", label: "Approve it — IT staff sometimes need access to fix account problems." },
      { id: "b", label: "Approve one request so the notifications stop." },
      { id: "c", label: "Deny the requests, hang up, change your password, and report it." },
      { id: "d", label: "Just ignore them — as long as you never approve, nothing else is needed." },
      UNSURE,
    ],
    key: {
      topic: "account",
      correct: ["c"],
      misconceptions: {
        a: "Complies because the caller claims authority",
        b: "Gives in to repeated prompts (MFA fatigue)",
        d: "Doesn't realise the password is already compromised",
      },
      rationale:
        "Approval prompts you didn't trigger mean someone already has your password. Real IT staff never need you to approve their sign-in.",
    },
  },
  {
    id: "k07_code_request",
    shortLabel: "Friend asks for a code",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt:
      "A friend messages you on social media, and a moment later you receive a verification code by text. What is the best response?",
    stimulus: {
      type: "chat",
      platform: "Direct message",
      contact: "Maya",
      messages: [
        "hey!! sorry, I accidentally put your number in for my login code 🙈",
        "can you send me the 6-digit code you just got?",
      ],
      incomingSms: "Your verification code is 482 913. Don't share this code with anyone.",
    },
    options: [
      { id: "a", label: "Send it — Maya is a friend, and it was an honest mix-up." },
      { id: "b", label: "Don't send it; contact Maya another way, as her account may be hijacked." },
      { id: "c", label: "Send it — codes expire in a few minutes, so it can't be misused." },
      { id: "d", label: "Send it, then change your password afterwards to be safe." },
      UNSURE,
    ],
    key: {
      topic: "impersonation",
      correct: ["b"],
      misconceptions: {
        a: "Trusts a familiar contact without verifying",
        c: "Believes short-lived codes are harmless to share",
        d: "Believes changing the password afterwards undoes the takeover",
      },
      rationale:
        "The code is for YOUR account. Attackers use hijacked friends' accounts to request it; once used, they can lock you out before you react.",
    },
  },
  {
    id: "k08_gift_cards",
    shortLabel: "Lecturer gift-card request",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt: "This email uses your lecturer's real name. What is the best response?",
    stimulus: {
      type: "email",
      fromName: "Dr. A. Rahman",
      fromAddress: "dr.arahman.office@gmail.com",
      subject: "Quick favour",
      body: [
        "Are you on campus? I need you to buy four gift cards for a department event — I'll reimburse you today.",
        "I'm in meetings and can't take calls, so just email me the codes.",
      ],
    },
    options: [
      { id: "a", label: "Buy the cards — it's urgent and comes from your lecturer." },
      { id: "b", label: "Reply asking for more details before you decide." },
      { id: "c", label: "Check with the lecturer through their university email or in person." },
      { id: "d", label: "Buy one card first and see whether they reimburse you." },
      UNSURE,
    ],
    key: {
      topic: "impersonation",
      correct: ["c"],
      misconceptions: {
        a: "Complies because the request appears to come from authority",
        b: "Continues the conversation with the impersonator",
        d: "Partially complies to “test” the request",
      },
      rationale:
        "A personal webmail address, urgency, secrecy (“can't take calls”) and gift cards are hallmarks of impersonation fraud. Verify through a channel you already know.",
    },
  },
  {
    id: "k09_qr_code",
    shortLabel: "QR code on a parking meter",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt: "You find this sticker on a campus parking meter. What should you do?",
    stimulus: {
      type: "sign",
      heading: "Card reader out of order",
      body: "Scan to pay for parking",
    },
    options: [
      { id: "a", label: "Scan it — a code on official equipment is safe to use." },
      { id: "b", label: "Scan it, and only pay if the page shows a padlock icon." },
      { id: "c", label: "Pay through the official parking app or another meter, and report the sticker." },
      { id: "d", label: "Scan it with your phone's built-in camera, which blocks unsafe links." },
      UNSURE,
    ],
    key: {
      topic: "mobile",
      correct: ["c"],
      misconceptions: {
        a: "Trusts a code because of where it is placed",
        b: "Believes the padlock means a site is safe",
        d: "Believes the scanning app makes links safe",
      },
      rationale:
        "Anyone can print a sticker. QR codes hide the destination, so pay through a channel you already trust and let staff know.",
    },
  },
  {
    id: "k10_after_click",
    shortLabel: "After entering a password",
    kind: "single",
    section: "knowledge",
    stages: BOTH,
    required: true,
    shuffle: true,
    prompt: "You typed your university password into a page that you now realise was fake. What should you do first?",
    options: [
      { id: "a", label: "Delete the email and watch for anything unusual." },
      { id: "b", label: "Run an antivirus scan on your device." },
      { id: "c", label: "Change the password on the real site straight away and report it." },
      { id: "d", label: "Nothing, as long as two-factor authentication is turned on." },
      UNSURE,
    ],
    key: {
      topic: "account",
      correct: ["c"],
      misconceptions: {
        a: "Waits passively instead of responding",
        b: "Believes antivirus fixes stolen credentials",
        d: "Over-relies on two-factor authentication",
      },
      rationale:
        "The attacker now has the password. Changing it (and anywhere it was reused) closes the window; reporting lets IT watch for misuse. 2FA helps but can be phished or fatigued too.",
    },
  },

  // -------------------------------------------------------------------------
  // Calibration (both stages): perceived vs demonstrated performance.
  // -------------------------------------------------------------------------
  {
    id: "s_estimate",
    shortLabel: "Self-estimated score",
    kind: "estimate",
    section: "self",
    stages: BOTH,
    required: true,
    prompt: "Out of the 10 scenario questions you just answered, how many do you think you got right?",
    help: "A quick guess is fine — this measures confidence, not knowledge.",
    scale: { min: 0, max: 10, minLabel: "None", maxLabel: "All 10" },
  },

  // -------------------------------------------------------------------------
  // Campaign exposure (POST only). Lets the team describe who actually saw the
  // intervention. Edit the options to match the channels you used.
  // -------------------------------------------------------------------------
  {
    id: "r_exposure",
    shortLabel: "Campaign exposure",
    kind: "multi",
    section: "reflection",
    stages: ["post"],
    required: true,
    prompt: "Since the first survey, which parts of our security awareness campaign did you see or take part in?",
    help: "Select all that apply.",
    options: [
      { id: "social_posts", label: "Social media posts or stories" },
      { id: "videos", label: "Short videos or reels" },
      { id: "posters", label: "Posters or flyers" },
      { id: "session", label: "A live session or workshop" },
      { id: "quiz", label: "An interactive quiz or poll" },
      { id: "none", label: "None of these", exclusive: true },
      { id: "unsure", label: "I'm not sure", exclusive: true },
    ],
  },
];

export const KNOWLEDGE_ITEMS = QUESTIONS.filter((q) => q.key);
export const KNOWLEDGE_MAX = KNOWLEDGE_ITEMS.length; // each item is worth 1 point

export function questionsForStage(stage: Stage): QuestionDefinition[] {
  return QUESTIONS.filter((q) => q.stages.includes(stage));
}

export function getQuestion(id: string): QuestionDefinition | undefined {
  return QUESTIONS.find((q) => q.id === id);
}
