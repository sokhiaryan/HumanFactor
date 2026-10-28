// Renders one question with native, keyboard-accessible inputs.
// Number keys 1–9 pick options as a shortcut; arrow keys move within radio groups
// natively; Tab/Space work everywhere.

import { useEffect, useId } from "react";
import type { AnswerValue, Option, PublicQuestion } from "../../../shared/types";
import { IconAlert, IconCheck } from "./icons";
import { Stimulus } from "./Stimulus";

interface Props {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | undefined) => void;
  /** Option ids in display order. */
  order?: string[];
  error?: string | null;
}

function orderedOptions(q: PublicQuestion, order?: string[]): Option[] {
  const opts = q.options ?? [];
  if (!order) return opts;
  const byId = new Map(opts.map((o) => [o.id, o]));
  const sorted = order.map((id) => byId.get(id)).filter((o): o is Option => !!o);
  return sorted.length === opts.length ? sorted : opts;
}

export function QuestionView({ question: q, value, onChange, order, error }: Props) {
  const promptId = useId();
  const helpId = useId();
  const errorId = useId();
  const options = orderedOptions(q, order);
  const describedBy = [q.help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const toggleMulti = (opt: Option) => {
    const current = Array.isArray(value) ? value : [];
    let next: string[];
    if (current.includes(opt.id)) next = current.filter((v) => v !== opt.id);
    else if (opt.exclusive) next = [opt.id];
    else {
      const exclusive = new Set((q.options ?? []).filter((o) => o.exclusive).map((o) => o.id));
      next = [...current.filter((v) => !exclusive.has(v)), opt.id];
    }
    onChange(next.length ? next : undefined);
  };

  // Keyboard shortcuts: 1–9 select the n-th option / scale point.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && (target as HTMLInputElement).type === "text") return;
      if (!/^[0-9]$/.test(e.key)) return;
      const n = Number(e.key);
      if (q.kind === "single" || q.kind === "multi") {
        const opt = options[n - 1];
        if (!opt) return;
        e.preventDefault();
        if (q.kind === "single") onChange(opt.id);
        else toggleMulti(opt);
      } else if (q.scale) {
        if (n >= q.scale.min && n <= q.scale.max) {
          e.preventDefault();
          onChange(n);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <h1 className="question-prompt" id={promptId}>
        {q.prompt}
      </h1>
      {q.help && (
        <p className="question-help" id={helpId}>
          {q.help}
        </p>
      )}
      {q.stimulus && <Stimulus data={q.stimulus} />}

      {(q.kind === "single" || q.kind === "multi") && (
        <fieldset
          className="options"
          role={q.kind === "single" ? "radiogroup" : "group"}
          aria-labelledby={promptId}
          aria-describedby={describedBy}
          aria-required={q.required || undefined}
          aria-invalid={!!error || undefined}
        >
          <legend className="sr-only">{q.prompt}</legend>
          {options.map((opt, i) => {
            const checked = q.kind === "single" ? value === opt.id : Array.isArray(value) && value.includes(opt.id);
            return (
              <label key={opt.id} className={`option${opt.exclusive ? " option--quiet" : ""}`}>
                <input
                  type={q.kind === "single" ? "radio" : "checkbox"}
                  name={q.id}
                  value={opt.id}
                  checked={checked}
                  onChange={() => (q.kind === "single" ? onChange(opt.id) : toggleMulti(opt))}
                />
                <span
                  className={`option__indicator option__indicator--${q.kind === "single" ? "radio" : "check"}`}
                  aria-hidden="true"
                >
                  <IconCheck size={14} />
                </span>
                <span className={`option__label${opt.mono ? " mono" : ""}`}>{opt.label}</span>
                {i < 9 && (
                  <span className="kbd option__key" aria-hidden="true">
                    {i + 1}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>
      )}

      {(q.kind === "likert" || q.kind === "estimate") && q.scale && (
        <fieldset
          className={`scale${q.kind === "estimate" ? " scale--dense" : ""}`}
          role="radiogroup"
          aria-labelledby={promptId}
          aria-describedby={describedBy}
          aria-required={q.required || undefined}
          aria-invalid={!!error || undefined}
        >
          <legend className="sr-only">{q.prompt}</legend>
          <div className="scale__buttons" style={{ ["--count" as string]: q.scale.max - q.scale.min + 1 }}>
            {Array.from({ length: q.scale.max - q.scale.min + 1 }, (_, i) => {
              const v = q.scale!.min + i;
              const word = q.scale!.labels?.[i];
              return (
                <label key={v} className="scale__btn">
                  <input
                    type="radio"
                    name={q.id}
                    value={v}
                    checked={value === v}
                    onChange={() => onChange(v)}
                    aria-label={word ? `${v} – ${word}` : String(v)}
                  />
                  <span className="scale__value">{v}</span>
                  {word && <span className="scale__word">{word}</span>}
                </label>
              );
            })}
          </div>
          <div className="scale__ends" aria-hidden="true">
            <span>{q.scale.minLabel}</span>
            <span>{q.scale.maxLabel}</span>
          </div>
        </fieldset>
      )}

      <div aria-live="polite">
        {error && (
          <p className="field-error" id={errorId}>
            <IconAlert size={16} /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
