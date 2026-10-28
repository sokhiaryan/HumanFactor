// Builds the participant-facing view of the survey. This is the ONLY path by which
// question data reaches the browser, so it copies an explicit allow-list of fields
// instead of spreading the definition (which would leak `key`).

import type { PublicQuestion, PublicSurvey, Stage } from "../../shared/types.js";
import { ESTIMATED_MINUTES, SURVEY_TITLE, SURVEY_TOPIC, SURVEY_VERSION, questionsForStage } from "./definition.js";

export function publicSurvey(stage: Stage): PublicSurvey {
  const questions: PublicQuestion[] = questionsForStage(stage).map((q) => ({
    id: q.id,
    kind: q.kind,
    section: q.section,
    prompt: q.prompt,
    help: q.help,
    stimulus: q.stimulus,
    options: q.options?.map((o) => ({ id: o.id, label: o.label, mono: o.mono, exclusive: o.exclusive })),
    shuffle: q.shuffle,
    scale: q.scale,
    required: q.required,
  }));
  return {
    version: SURVEY_VERSION,
    stage,
    title: SURVEY_TITLE,
    topic: SURVEY_TOPIC,
    estimatedMinutes: ESTIMATED_MINUTES[stage],
    questions,
  };
}
