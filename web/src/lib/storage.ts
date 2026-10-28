// Per-device persistence for in-progress answers. Browser storage can be unavailable
// (private mode, blocked site data), so every access is guarded and the survey still
// works without it — you just can't resume after closing the tab.

import type { Answers, Stage } from "../../../shared/types";

export interface Draft {
  /** Survey version the draft belongs to; drafts from another version are discarded. */
  version: string;
  sessionId: string;
  participantCode: string | null;
  answers: Answers;
  index: number;
  /** Option display order per question id (shuffled once per session). */
  order: Record<string, string[]>;
  savedAt: string;
}

export interface Completion {
  at: string;
  code: string | null;
}

const draftKey = (stage: Stage) => `hlac:draft:${stage}`;
const doneKey = (stage: Stage) => `hlac:done:${stage}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: carry on without persistence */
  }
}

export const loadDraft = (stage: Stage) => read<Draft>(draftKey(stage));
export const saveDraft = (stage: Stage, draft: Draft) => write(draftKey(stage), draft);
export const clearDraft = (stage: Stage) => write(draftKey(stage), null);

export const loadCompletion = (stage: Stage) => read<Completion>(doneKey(stage));
export const saveCompletion = (stage: Stage, c: Completion) => write(doneKey(stage), c);
export const clearCompletion = (stage: Stage) => write(doneKey(stage), null);
