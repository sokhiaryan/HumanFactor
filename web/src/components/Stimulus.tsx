// Realistic but clearly illustrative mock-ups of the message a scenario refers to.
// All names, numbers and domains are fictional.

import type { Stimulus as StimulusData } from "../../../shared/types";
import { IconLock, IconMail, IconPhone } from "./icons";

const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Highlights bare domains/URLs inside message text so they read like links. */
function withLinks(text: string) {
  const parts = text.split(/(\b[\w-]+(?:\.[\w-]+)+\/[\w\-/]*)/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="link">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export function Stimulus({ data }: { data: StimulusData }) {
  switch (data.type) {
    case "email":
      return (
        <figure className="stimulus" aria-label="Example email">
          <figcaption className="stimulus__caption">
            <IconMail size={14} /> Email
          </figcaption>
          <div className="mail">
            <div className="mail__head">
              <span className="avatar" aria-hidden="true">
                {initials(data.fromName)}
              </span>
              <div className="mail__from">
                <strong>{data.fromName}</strong>
                <div className="mail__addr">&lt;{data.fromAddress}&gt;</div>
              </div>
            </div>
            <div className="mail__subject">{data.subject}</div>
            <div className="mail__body">
              {data.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {data.cta && (
                <span className="mail__cta" aria-hidden="true">
                  {data.cta}
                </span>
              )}
              {data.cta && <span className="sr-only">The email contains a button labelled “{data.cta}”.</span>}
            </div>
          </div>
        </figure>
      );

    case "sms":
      return (
        <figure className="stimulus" aria-label="Example text message">
          <figcaption className="stimulus__caption">
            <IconPhone size={14} /> Text message
          </figcaption>
          <div className="phone">
            <div className="phone__bar">
              <span className="avatar" aria-hidden="true">
                #
              </span>
              <strong>{data.sender}</strong>
            </div>
            <div className="phone__body">
              <div className="phone__time">Today 09:41</div>
              <div className="bubble">{withLinks(data.body)}</div>
            </div>
          </div>
        </figure>
      );

    case "chat":
      return (
        <figure className="stimulus" aria-label="Example social media conversation">
          <figcaption className="stimulus__caption">
            <IconPhone size={14} /> {data.platform}
          </figcaption>
          <div className="phone">
            {data.incomingSms && (
              <div className="sms-drop" role="note" aria-label="Text message notification arriving at the same time">
                <div className="sms-drop__app">Messages · now</div>
                {data.incomingSms}
              </div>
            )}
            <div className="phone__bar">
              <span className="avatar" aria-hidden="true">
                {initials(data.contact)}
              </span>
              <strong>{data.contact}</strong>
            </div>
            <div className="phone__body">
              {data.messages.map((m, i) => (
                <div key={i} className="bubble">
                  {m}
                </div>
              ))}
            </div>
          </div>
        </figure>
      );

    case "notification": {
      const layers = Math.min(3, Math.max(0, (data.count ?? 1) - 1));
      return (
        <figure className="stimulus" aria-label={`Example phone notification, shown ${data.count ?? 1} times`}>
          <figcaption className="stimulus__caption">
            <IconPhone size={14} /> Lock screen · 11:52 pm
          </figcaption>
          <div className="notif-stack" style={{ ["--layers" as string]: layers }}>
            {Array.from({ length: layers }, (_, i) => (
              <div key={i} className="notif-ghost" style={{ ["--i" as string]: i + 1 }} aria-hidden="true" />
            ))}
            <div className="notif">
              <span className="notif__icon" aria-hidden="true">
                <IconLock size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="notif__app">
                  {data.app}
                  {data.count && data.count > 1 ? ` · ${data.count} requests` : ""}
                </div>
                <div className="notif__title">{data.title}</div>
                <div className="small muted">{data.body}</div>
                <div className="notif__actions" aria-hidden="true">
                  <span>Deny</span>
                  <span>Approve</span>
                </div>
              </div>
            </div>
          </div>
        </figure>
      );
    }

    case "sign":
      return (
        <figure className="stimulus" aria-label={`Photo of a sticker: ${data.heading}. ${data.body}. With a QR code.`}>
          <figcaption className="stimulus__caption">Sticker on the meter</figcaption>
          <div className="sticker" aria-hidden="true">
            <FakeQr />
            <div>
              <div className="sticker__heading">{data.heading}</div>
              <div className="sticker__body">{data.body} →</div>
            </div>
          </div>
        </figure>
      );
  }
}

/** A decorative QR-like pattern. It is deliberately NOT a scannable code. */
function FakeQr() {
  const n = 21;
  const cells: [number, number][] = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rand() > 0.52) cells.push([x, y]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#111" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#111" />
    </g>
  );
  return (
    <svg width="92" height="92" viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
      {cells.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill="#111" />
      ))}
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  );
}
