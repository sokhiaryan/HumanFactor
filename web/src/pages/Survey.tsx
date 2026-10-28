// Participant flow: intro → consent → (POST: code entry | PRE: code reveal) → one
// question per screen → review → submit → done.
//
// Answers are saved to this device after every change, so a refresh, a dropped
// connection or a server error never loses them. The server, not the client, scores.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatCode, isValidCode, normalizeCode } from "../../../shared/participantCode";
import type {
  AnswerValue,
  Answers,
  CreateSessionResponse,
  PublicQuestion,
  PublicSurvey,
  Section,
  Stage,
  SubmitResponse,
} from "../../../shared/types";
import { api, ApiRequestError } from "../api";
import { Brand } from "../components/Brand";
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconClock,
  IconCopy,
  IconDownload,
  IconEyeOff,
  IconInfo,
  IconKey,
  IconLock,
  IconShield,
  IconUndo,
} from "../components/icons";
import { PrivacyNotice } from "../components/PrivacyNotice";
import { QuestionView } from "../components/QuestionView";
import {
  clearCompletion,
  clearDraft,
  loadCompletion,
  loadDraft,
  saveCompletion,
  saveDraft,
  type Completion,
  type Draft,
} from "../lib/storage";
import { STUDY } from "../studyInfo";

type Phase =
  | { name: "loading" }
  | { name: "load-error"; message: string }
  | { name: "intro" }
  | { name: "consent" }
  | { name: "code-entry" }
  | { name: "code-reveal" }
  | { name: "question"; index: number; dir: 1 | -1 }
  | { name: "review" }
  | { name: "done"; code: string | null; matched: boolean }
  | { name: "already"; message: string };

const SECTION_LABEL: Record<Section, string> = {
  about: "About you",
  self: "Your confidence",
  knowledge: "Scenario",
  reflection: "The campaign",
};

// --- helpers -------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic per-session shuffle; exclusive options ("I'm not sure") stay last. */
function buildOrder(questions: PublicQuestion[], seed: string): Record<string, string[]> {
  const order: Record<string, string[]> = {};
  for (const q of questions) {
    if (!q.options || !q.shuffle) continue;
    const movable = q.options.filter((o) => !o.exclusive).map((o) => o.id);
    const fixed = q.options.filter((o) => o.exclusive).map((o) => o.id);
    let x = hash(seed + q.id) || 1;
    for (let i = movable.length - 1; i > 0; i--) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      const j = (x >>> 0) % (i + 1);
      [movable[i], movable[j]] = [movable[j], movable[i]];
    }
    order[q.id] = [...movable, ...fixed];
  }
  return order;
}

const isAnswered = (v: AnswerValue | undefined) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

function downloadCode(code: string) {
  const text = `${STUDY.title} — your anonymous participant code\n\n    ${formatCode(code)}\n\nYou'll need this for the follow-up survey.\nIt is not linked to your name or any account.\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "spot-the-hook-code.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- component -----------------------------------------------------------------------

export default function Survey({ stage }: { stage: Stage }) {
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resumable, setResumable] = useState<Draft | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);

  // Load the survey and any saved progress.
  const load = useCallback(async () => {
    setPhase({ name: "loading" });
    try {
      const s = await api<PublicSurvey>(`/survey/${stage}`);
      setSurvey(s);
      const saved = loadDraft(stage);
      setResumable(saved && saved.version === s.version ? saved : null);
      setCompletion(loadCompletion(stage));
      setPhase({ name: "intro" });
    } catch (e) {
      setPhase({ name: "load-error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }, [stage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Persist progress after every change.
  const update = useCallback(
    (patch: Partial<Draft>) => {
      setDraft((d) => {
        if (!d) return d;
        const next = { ...d, ...patch, savedAt: new Date().toISOString() };
        saveDraft(stage, next);
        return next;
      });
    },
    [stage],
  );

  // Move focus to the new step for keyboard and screen-reader users.
  const phaseKey = phase.name === "question" ? `q${phase.index}` : phase.name;
  useEffect(() => {
    window.scrollTo({ top: 0 });
    focusRef.current?.focus({ preventScroll: true });
  }, [phaseKey]);

  const questions = survey?.questions ?? [];
  const total = questions.length;

  const startSession = async (participantCode: string | null): Promise<Draft | null> => {
    if (!survey) return null;
    setBusy(true);
    setBanner(null);
    try {
      const res = await api<CreateSessionResponse>("/sessions", { method: "POST", json: { stage, participantCode } });
      const d: Draft = {
        version: survey.version,
        sessionId: res.sessionId,
        participantCode: res.participantCode,
        answers: {},
        index: 0,
        order: buildOrder(survey.questions, res.sessionId),
        savedAt: new Date().toISOString(),
      };
      saveDraft(stage, d);
      setDraft(d);
      return d;
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === "already_submitted") {
        setPhase({ name: "already", message: e.message });
      } else {
        setBanner(e instanceof Error ? e.message : "Something went wrong.");
      }
      return null;
    } finally {
      setBusy(false);
    }
  };

  const goToQuestion = (index: number, dir: 1 | -1 = 1) => {
    update({ index });
    setPhase({ name: "question", index, dir });
  };

  const next = () => {
    if (phase.name !== "question" || !draft) return;
    const q = questions[phase.index];
    if (q.required && !isAnswered(draft.answers[q.id])) {
      setErrors((e) => ({ ...e, [q.id]: q.kind === "multi" ? "Choose at least one option to continue." : "Choose an answer to continue." }));
      return;
    }
    if (phase.index + 1 < total) goToQuestion(phase.index + 1, 1);
    else setPhase({ name: "review" });
  };

  const back = () => {
    if (phase.name === "question" && phase.index > 0) goToQuestion(phase.index - 1, -1);
    else if (phase.name === "review") goToQuestion(total - 1, -1);
  };

  const setAnswer = (q: PublicQuestion, value: AnswerValue | undefined) => {
    if (!draft) return;
    const answers: Answers = { ...draft.answers };
    if (value === undefined) delete answers[q.id];
    else answers[q.id] = value;
    update({ answers });
    if (errors[q.id]) setErrors(({ [q.id]: _removed, ...rest }) => rest);
  };

  const submit = async (retried = false): Promise<void> => {
    if (!draft || !survey) return;
    const missing = questions.findIndex((q) => q.required && !isAnswered(draft.answers[q.id]));
    if (missing >= 0) {
      setErrors((e) => ({ ...e, [questions[missing].id]: "This question still needs an answer." }));
      goToQuestion(missing, -1);
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const res = await api<SubmitResponse>("/responses", {
        method: "POST",
        json: { sessionId: draft.sessionId, answers: draft.answers },
      });
      const done: Completion = { at: new Date().toISOString(), code: res.participantCode };
      saveCompletion(stage, done);
      clearDraft(stage);
      setCompletion(done);
      setPhase({ name: "done", code: res.participantCode, matched: stage === "post" && !!res.participantCode });
    } catch (e) {
      if (!(e instanceof ApiRequestError)) {
        setBanner("Something went wrong. Your answers are saved on this device — please try again.");
      } else if (e.code === "invalid_answers" && e.fields) {
        setErrors(e.fields);
        const first = questions.findIndex((q) => e.fields![q.id]);
        if (first >= 0) goToQuestion(first, -1);
        else setBanner(e.message);
      } else if (e.code === "already_submitted") {
        clearDraft(stage);
        setPhase({ name: "already", message: e.message });
      } else if (e.code === "session_not_found" && !retried) {
        // Session lost on the server (e.g. database reset): open a new one, keep answers, retry once.
        const fresh = await startSession(stage === "post" ? draft.participantCode : null);
        if (fresh) {
          const merged = { ...fresh, answers: draft.answers, order: draft.order, index: draft.index };
          saveDraft(stage, merged);
          setDraft(merged);
          setBusy(false);
          return submitWith(merged);
        }
      } else {
        setBanner(`${e.message}${e.isNetwork || e.status >= 500 ? " Your answers are saved on this device." : ""}`);
      }
    } finally {
      setBusy(false);
    }
  };

  // Submits a specific draft (used after re-creating a lost session).
  const submitWith = async (d: Draft) => {
    setBusy(true);
    try {
      const res = await api<SubmitResponse>("/responses", { method: "POST", json: { sessionId: d.sessionId, answers: d.answers } });
      const done: Completion = { at: new Date().toISOString(), code: res.participantCode };
      saveCompletion(stage, done);
      clearDraft(stage);
      setPhase({ name: "done", code: res.participantCode, matched: stage === "post" && !!res.participantCode });
    } catch (e) {
      setBanner(`${e instanceof Error ? e.message : "Something went wrong."} Your answers are saved on this device.`);
    } finally {
      setBusy(false);
    }
  };

  // Enter = continue (when focus isn't on a control that already handles Enter).
  useEffect(() => {
    if (phase.name !== "question") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "BUTTON" || t.tagName === "A" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- progress ---------------------------------------------------------------------------
  const progress = useMemo(() => {
    if (!total) return 0;
    switch (phase.name) {
      case "question":
        return phase.index / total;
      case "review":
        return 0.98;
      case "done":
      case "already":
        return 1;
      default:
        return 0;
    }
  }, [phase, total]);

  const showChrome = !["loading", "load-error"].includes(phase.name);

  return (
    <div className="survey">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="survey-top" data-scrolled={scrolled}>
        <div className="shell survey-top__inner">
          <Brand />
          <span className="spacer" />
          {showChrome && (
            <span className={`pill ${stage === "post" ? "pill--accent" : ""}`}>
              {stage === "pre" ? "Part 1 · Before" : "Part 2 · After"}
            </span>
          )}
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Survey progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="progress__bar" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <main id="main" className="survey-main">
        <div className="shell shell--narrow">
          <div ref={focusRef} tabIndex={-1} style={{ outline: "none", boxShadow: "none" }} aria-live="off">
            {banner && (
              <div className="notice notice--bad" role="alert" style={{ marginBottom: 24 }}>
                <IconAlert size={18} />
                <div style={{ flex: 1 }}>{banner}</div>
              </div>
            )}

            {phase.name === "loading" && <p className="muted" aria-busy="true">Loading the survey…</p>}

            {phase.name === "load-error" && (
              <div className="stack">
                <h1 className="h2">We couldn't load the survey</h1>
                <p className="muted">{phase.message}</p>
                <button className="btn btn--primary" onClick={load}>
                  Try again
                </button>
              </div>
            )}

            {phase.name === "intro" && survey && (
              <Intro
                stage={stage}
                survey={survey}
                resumable={resumable}
                completion={completion}
                onStart={() => setPhase({ name: "consent" })}
                onResume={(d) => {
                  setDraft(d);
                  setPhase({ name: "question", index: Math.min(d.index, total - 1), dir: 1 });
                }}
                onDiscard={() => {
                  clearDraft(stage);
                  setResumable(null);
                }}
                onClearCompletion={() => {
                  clearCompletion(stage);
                  setCompletion(null);
                }}
              />
            )}

            {phase.name === "consent" && (
              <Consent
                busy={busy}
                onBack={() => setPhase({ name: "intro" })}
                onAgree={async () => {
                  if (stage === "post") setPhase({ name: "code-entry" });
                  else if (await startSession(null)) setPhase({ name: "code-reveal" });
                }}
              />
            )}

            {phase.name === "code-entry" && (
              <CodeEntry
                busy={busy}
                onContinue={async (code) => {
                  if (await startSession(code)) goToQuestion(0);
                }}
                onAlready={(message) => setPhase({ name: "already", message })}
              />
            )}

            {phase.name === "code-reveal" && draft?.participantCode && (
              <CodeReveal code={draft.participantCode} onContinue={() => goToQuestion(0)} />
            )}

            {phase.name === "question" && draft && questions[phase.index] && (
              <div key={phase.index} className={`enter${phase.dir < 0 ? " enter--back" : ""}`}>
                <div className="step-meta">
                  <span>
                    Question {phase.index + 1} of {total}
                  </span>
                  <span className="step-meta__sep" aria-hidden="true" />
                  <span>{SECTION_LABEL[questions[phase.index].section]}</span>
                  {!questions[phase.index].required && (
                    <>
                      <span className="step-meta__sep" aria-hidden="true" />
                      <span>Optional</span>
                    </>
                  )}
                </div>
                <QuestionView
                  question={questions[phase.index]}
                  value={draft.answers[questions[phase.index].id]}
                  onChange={(v) => setAnswer(questions[phase.index], v)}
                  order={draft.order[questions[phase.index].id]}
                  error={errors[questions[phase.index].id]}
                />
              </div>
            )}

            {phase.name === "review" && draft && (
              <Review
                questions={questions}
                answers={draft.answers}
                busy={busy}
                onEdit={(i) => goToQuestion(i, -1)}
                onSubmit={() => submit()}
              />
            )}

            {phase.name === "done" && <Done stage={stage} code={phase.code} />}

            {phase.name === "already" && (
              <div className="stack" style={{ ["--gap" as string]: "18px" }}>
                <div className="done-mark" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                  </svg>
                </div>
                <h1 className="display">Already recorded</h1>
                <p className="lede">{phase.message}</p>
                <Link to="/" className="btn">
                  Back to the start
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {phase.name === "question" && draft && (
        <nav className="survey-nav" aria-label="Question navigation">
          <div className="shell shell--narrow survey-nav__inner">
            <button className="btn btn--ghost" onClick={back} disabled={phase.index === 0} aria-label="Previous question">
              <IconArrowLeft size={16} /> Back
            </button>
            <span className="spacer" />
            <span className="hint">
              <span className="kbd">Enter</span> to continue
            </span>
            {!questions[phase.index].required && !isAnswered(draft.answers[questions[phase.index].id]) ? (
              <button className="btn" onClick={next}>
                Skip
              </button>
            ) : (
              <button className="btn btn--primary" onClick={next}>
                {phase.index + 1 === total ? "Review" : "Next"} <IconArrowRight size={16} />
              </button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

// --- steps ---------------------------------------------------------------------------------

function Intro(props: {
  stage: Stage;
  survey: PublicSurvey;
  resumable: Draft | null;
  completion: Completion | null;
  onStart: () => void;
  onResume: (d: Draft) => void;
  onDiscard: () => void;
  onClearCompletion: () => void;
}) {
  const { stage, survey, resumable, completion } = props;
  const answered = resumable ? Object.keys(resumable.answers).length : 0;
  return (
    <div className="enter">
      <p className="eyebrow">{stage === "pre" ? "Part 1 of 2 · Before the campaign" : "Part 2 of 2 · After the campaign"}</p>
      <h1 className="display" style={{ margin: "14px 0 18px" }}>
        {stage === "pre" ? (
          <>
            Can you spot <em>the hook?</em>
          </>
        ) : (
          <>
            Welcome <em>back.</em>
          </>
        )}
      </h1>
      <p className="lede">
        {stage === "pre"
          ? "We're students running an awareness campaign about phishing and online scams. This short survey shows what people already know before the campaign, so we can measure what changes afterwards."
          : "Thanks for coming back. This follow-up uses the same everyday scenarios as the first survey so we can see what changed. Have your participant code from the first survey ready."}
      </p>

      <div className="facts">
        <div className="fact">
          <div className="fact__value row" style={{ gap: 6 }}>
            <IconClock size={16} /> ~{survey.estimatedMinutes} min
          </div>
          <div className="fact__label">{survey.questions.length} short questions</div>
        </div>
        <div className="fact">
          <div className="fact__value row" style={{ gap: 6 }}>
            <IconEyeOff size={16} /> Anonymous
          </div>
          <div className="fact__label">No name, email or login</div>
        </div>
        <div className="fact">
          <div className="fact__value row" style={{ gap: 6 }}>
            <IconUndo size={16} /> Auto-saved
          </div>
          <div className="fact__label">Pick up where you left off</div>
        </div>
      </div>

      <p className="muted" style={{ marginBottom: 28 }}>
        This isn't a test of you — there are no grades, and <strong>“I'm not sure”</strong> is always a fine answer. Please
        answer on your own, without looking things up.
      </p>

      {completion && !resumable && (
        <div className="notice notice--good" style={{ marginBottom: 20 }}>
          <IconCheck size={18} />
          <div style={{ flex: 1 }}>
            You already completed this survey on this device
            {completion.code ? (
              <>
                {" "}
                — your code is <span className="mono">{formatCode(completion.code)}</span>
              </>
            ) : null}
            . Only take it again if someone else is using this device.{" "}
            <button className="btn btn--ghost btn--sm" style={{ marginLeft: -8 }} onClick={props.onClearCompletion}>
              Someone else is taking it
            </button>
          </div>
        </div>
      )}

      {resumable ? (
        <div className="stack">
          <div className="notice">
            <IconInfo size={18} />
            <div>
              You have a survey in progress on this device ({answered} of {survey.questions.length} answered).
            </div>
          </div>
          <div className="row">
            <button className="btn btn--primary btn--lg" onClick={() => props.onResume(resumable)}>
              Continue where I left off <IconArrowRight size={16} />
            </button>
            <button className="btn btn--ghost" onClick={props.onDiscard}>
              Start over
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn--primary btn--lg" onClick={props.onStart} disabled={!!completion}>
          Get started <IconArrowRight size={16} />
        </button>
      )}
    </div>
  );
}

function Consent({ busy, onAgree, onBack }: { busy: boolean; onAgree: () => void; onBack: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="enter">
      <p className="eyebrow">Before you begin</p>
      <h1 className="display" style={{ margin: "14px 0 8px", fontSize: "clamp(2rem, 5vw, 2.6rem)" }}>
        Your privacy &amp; <em>consent</em>
      </h1>
      <ul className="consent-list">
        <li>
          <span className="consent-list__icon">
            <IconEyeOff size={16} />
          </span>
          <span>
            <strong>Anonymous.</strong> We never ask for your name, email or student ID, and we don't store your IP address.
          </span>
        </li>
        <li>
          <span className="consent-list__icon">
            <IconKey size={16} />
          </span>
          <span>
            <strong>A random code links your two surveys.</strong> It's generated for you and isn't connected to who you are.
          </span>
        </li>
        <li>
          <span className="consent-list__icon">
            <IconShield size={16} />
          </span>
          <span>
            <strong>Voluntary.</strong> Stop any time by closing the page — nothing is sent until you submit. You can withdraw
            later by emailing us your code.
          </span>
        </li>
        <li>
          <span className="consent-list__icon">
            <IconLock size={16} />
          </span>
          <span>
            <strong>Only our team sees responses,</strong> and results are reported only as group statistics.
          </span>
        </li>
      </ul>

      <details className="disclosure">
        <summary>Read the full participant information</summary>
        <PrivacyNotice />
      </details>

      <div className="stack" style={{ marginTop: 28 }}>
        <label className="checkbox-row">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I am 18 or older, I have read the information above, and I agree to take part.</span>
        </label>
        <div className="row">
          <button className="btn btn--primary btn--lg" disabled={!agreed || busy} onClick={onAgree} aria-disabled={!agreed}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            I agree — start the survey
          </button>
          <button className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
        </div>
        {!agreed && <p className="tiny muted">You need to tick the box to continue.</p>}
      </div>
    </div>
  );
}

function CodeEntry({
  busy,
  onContinue,
  onAlready,
}: {
  busy: boolean;
  onContinue: (code: string | null) => void;
  onAlready: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [noCode, setNoCode] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotFound(false);
    if (!isValidCode(value)) {
      setError("That code doesn't look right. It has 8 characters, like K7QM-3XP9 — check each one.");
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const res = await api<{ preFound: boolean; postSubmitted: boolean }>("/codes/check", {
        method: "POST",
        json: { participantCode: value },
      });
      if (res.postSubmitted) onAlready("A follow-up response has already been recorded for this code. Thank you — there's nothing more to do.");
      else if (!res.preFound) setNotFound(true);
      else onContinue(normalizeCode(value));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setChecking(false);
    }
  };

  if (noCode) {
    return (
      <div className="enter stack" style={{ ["--gap" as string]: "18px" }}>
        <p className="eyebrow">No code? No problem</p>
        <h1 className="h2">You can still take part</h1>
        <p className="muted">
          Your answers still count towards the overall results. We just won't be able to compare them with your first survey.
        </p>
        <div className="row">
          <button className="btn btn--primary btn--lg" disabled={busy} onClick={() => onContinue(null)}>
            {busy && <span className="spinner" aria-hidden="true" />} Continue without a code
          </button>
          <button className="btn btn--ghost" onClick={() => setNoCode(false)}>
            I found my code
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="enter stack" style={{ ["--gap" as string]: "18px" }} onSubmit={check} noValidate>
      <p className="eyebrow">Your participant code</p>
      <h1 className="h2">Enter the code from your first survey</h1>
      <p className="muted">
        It looks like <span className="mono">K7QM-3XP9</span>. Check your screenshot, notes, or the file you downloaded.
      </p>
      <div className="field">
        <label htmlFor="code">Participant code</label>
        <input
          id="code"
          className="input input--code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase().slice(0, 12));
            setError(null);
            setNotFound(false);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          placeholder="XXXX-XXXX"
          aria-invalid={!!error}
          aria-describedby={error ? "code-error" : undefined}
        />
        <div aria-live="polite">
          {error && (
            <p className="field-error" id="code-error">
              <IconAlert size={16} /> {error}
            </p>
          )}
        </div>
      </div>
      {notFound && (
        <div className="notice notice--warn" role="status">
          <IconAlert size={18} />
          <div style={{ flex: 1 }}>
            <p>We couldn't find a first-survey response for this code. Double-check it, or continue anyway.</p>
            <button
              type="button"
              className="btn btn--sm"
              style={{ marginTop: 10 }}
              disabled={busy}
              onClick={() => onContinue(normalizeCode(value))}
            >
              Use this code anyway
            </button>
          </div>
        </div>
      )}
      <div className="row">
        <button className="btn btn--primary btn--lg" type="submit" disabled={checking || busy}>
          {(checking || busy) && <span className="spinner" aria-hidden="true" />} Continue <IconArrowRight size={16} />
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setNoCode(true)}>
          I don't have my code
        </button>
      </div>
    </form>
  );
}

function CodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatCode(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the code is selectable */
    }
  };
  return (
    <div className="code-card">
      <div className="eyebrow">Your anonymous code</div>
      <div className="code-value" aria-label={`Your code is ${formatCode(code).split("").join(" ")}`}>
        {formatCode(code)}
      </div>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="btn btn--sm" onClick={copy}>
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />} {copied ? "Copied" : "Copy"}
        </button>
        <button className="btn btn--sm" onClick={() => downloadCode(code)}>
          <IconDownload size={16} /> Save as file
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Code copied to clipboard" : ""}
      </span>
    </div>
  );
}

function CodeReveal({ code, onContinue }: { code: string; onContinue: () => void }) {
  return (
    <div className="enter stack" style={{ ["--gap" as string]: "20px" }}>
      <p className="eyebrow">One quick thing</p>
      <h1 className="h2">Save this code for the follow-up survey</h1>
      <p className="muted">
        After our campaign we'll ask you to take a short follow-up. Entering this code lets us compare your two sets of answers
        — without ever knowing who you are. Take a screenshot, copy it, or save it as a file.
      </p>
      <CodeCard code={code} />
      <div className="row">
        <button className="btn btn--primary btn--lg" onClick={onContinue}>
          I've saved it — start <IconArrowRight size={16} />
        </button>
      </div>
      <p className="tiny muted">We'll show it again at the end.</p>
    </div>
  );
}

function summarize(q: PublicQuestion, v: AnswerValue | undefined): string {
  if (!isAnswered(v)) return q.required ? "Not answered" : "Skipped";
  if (typeof v === "number") return q.scale?.labels?.[v - q.scale.min] ? `${v} – ${q.scale.labels[v - q.scale.min]}` : String(v);
  const ids = Array.isArray(v) ? v : [v as string];
  return ids.map((id) => q.options?.find((o) => o.id === id)?.label ?? id).join("; ");
}

function Review(props: {
  questions: PublicQuestion[];
  answers: Answers;
  busy: boolean;
  onEdit: (index: number) => void;
  onSubmit: () => void;
}) {
  const { questions, answers } = props;
  const answered = questions.filter((q) => isAnswered(answers[q.id])).length;
  return (
    <div className="enter stack" style={{ ["--gap" as string]: "20px" }}>
      <p className="eyebrow">Almost done</p>
      <h1 className="h2">Ready to submit?</h1>
      <p className="muted">
        You can still change any answer. Once you submit, your response is final.
      </p>
      <details className="card card--pad" style={{ padding: 0 }}>
        <summary className="row" style={{ padding: "16px 20px", cursor: "pointer", fontWeight: 550 }}>
          Review your answers
          <span className="spacer" />
          <span className="muted small">
            {answered} of {questions.length} answered
          </span>
        </summary>
        <ol style={{ margin: 0, padding: "0 20px 16px 40px" }}>
          {questions.map((q, i) => (
            <li key={q.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <div className="small" style={{ fontWeight: 550 }}>
                {q.prompt}
              </div>
              <div className="row small" style={{ marginTop: 4 }}>
                <span className="muted" style={{ flex: 1 }}>
                  {summarize(q, answers[q.id])}
                </span>
                <button className="btn btn--ghost btn--sm" onClick={() => props.onEdit(i)}>
                  Change
                </button>
              </div>
            </li>
          ))}
        </ol>
      </details>
      <div className="row">
        <button className="btn btn--accent btn--lg" disabled={props.busy} onClick={props.onSubmit}>
          {props.busy ? <span className="spinner" aria-hidden="true" /> : <IconCheck size={16} />}
          {props.busy ? "Submitting…" : "Submit my answers"}
        </button>
        <button className="btn btn--ghost" onClick={() => props.onEdit(questions.length - 1)} disabled={props.busy}>
          <IconArrowLeft size={16} /> Back
        </button>
      </div>
    </div>
  );
}

function Done({ stage, code }: { stage: Stage; code: string | null }) {
  return (
    <div className="stack" style={{ ["--gap" as string]: "20px" }}>
      <div className="done-mark" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
      </div>
      <h1 className="display">
        Thank you<em>.</em>
      </h1>
      <p className="lede" role="status">
        Your response has been recorded.{" "}
        {stage === "pre"
          ? "Keep an eye out for our campaign — and keep your code safe for the follow-up."
          : code
            ? "It will be compared anonymously with your first survey."
            : "It will be included in the overall results."}
      </p>
      {stage === "pre" && code && <CodeCard code={code} />}
      <div className="notice">
        <IconShield size={18} />
        <div>
          <strong>A quick tip to take with you:</strong> when a message creates urgency or asks for a code, password or payment,
          stop and check through a channel you already trust — the official app, website, or the person directly.
        </div>
      </div>
      <p className="small muted">
        You can close this tab now. <Link to="/privacy">Privacy information</Link>
      </p>
    </div>
  );
}
