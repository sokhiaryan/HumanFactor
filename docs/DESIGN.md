# HumanFactor — design system

**World:** 1970s public-information print, the two-ink safety leaflet. A security-awareness
survey *is* a public-information campaign, so the interface borrows that campaign's material:
spot inks on form stock, ruled boxes, halftone screens, tickets and rubber stamps. It avoids
neon "retro" (synthwave, CRT), which reads as gaming and fails accessibility for an education
audience.

Tokens live in [`web/src/styles.css`](../web/src/styles.css); the dashboard extends them in
[`web/src/dashboard/dashboard.css`](../web/src/dashboard/dashboard.css).

## Colour

| Role | Light ("day print") | Dark ("night print") |
|---|---|---|
| Ground (form stock) `--bg` | `#e9ece6` | `#0e1524` |
| Sheet `--bg-elev` | `#f6f7f2` | `#151e33` |
| Ink `--ink` | `#14213d` navy | `#eceee6` paper |
| Secondary text `--muted` | `#4e5a72` | `#a3acbe` |
| Second ink `--marigold` | `#f2b01e` | `#f2b01e` |
| Interactive `--accent` | navy (paper text) | marigold (navy text) |
| Control borders `--line-strong` | `#7c8597` | `#6c7894` |
| Signals | good `#1d6a45`, bad `#a4271b`, warn `#7a5100` | lightened equivalents |

Rules:

- Two inks only. Marigold is used as a **field** (plates, tickets, selected answers, highlight
  bands), never as small text on the light ground.
- Signal colours (green, red, amber) are functional only: errors, improved/declined, warnings.
- In charts, PRE is ochre and POST is ink, with direct labels and legends, so colour is never the
  only cue.

## Type

- **Archivo Variable** (self-hosted) for everything, using the width axis:
  - display headings `wdth 125`, weight 760, tight tracking;
  - section and question headings `wdth 108–112`, weight 700;
  - body `wdth 100`, 17px / 1.55.
- **JetBrains Mono Variable** only for data: participant codes, question numbers (`Q05`), the
  progress counter, URLs in options, and tabular figures in the dashboard.
- Emphasis inside display headings is a marigold overprint band, not italics.
- No labels above headings; the heading carries its own weight.

## Shape and material

- Corners 4–8px. Borders are ink rules (1–1.5px); panels are ruled sheets, not floating cards.
- Depth is a press-like inset bottom edge on buttons and selected answers. There are no soft
  "card" shadows and no hard offset shadows.
- **Masthead:** a 6px ink rule above a 1px hairline on every page.
- **Halftone:** a dot screen on the marigold plate and on the grey "exhibit board" behind scenario
  mock-ups. Mock-ups themselves (email, SMS, notification, sticker) keep neutral device styling,
  so they read as real messages.

## Signature components

| Component | Where | Notes |
|---|---|---|
| Vitruvian mark | header, favicon, ticket stub, stamp | `BrandMark` (one leg pose, for small sizes) and `VitruvianDrawing` (construction lines and ticks, for plates). 64-unit grid, `currentColor`. |
| Ruler progress | survey header | One tick per question: done = marigold, current = tall ink tick, plus a mono `05/15` counter. |
| Ballot options | questions | Radio = circle, checkbox = square. Selected = marigold-soft field, ink mark, press edge. "I'm not sure" is dashed and always last. |
| Form-strip scale | confidence / estimate | One ruled strip of boxes; the selected box fills marigold. |
| Ticket stub | participant code | A marigold ticket with punched notches and a perforated stub carrying the mark. |
| Rubber stamp | completion | A ring with "RESPONSE RECORDED · HUMANFACTOR ·" around the mark, rotated −9°. The flow's one authored motion moment (stamp-in). |

## Icons

The custom set in [`web/src/components/icons.tsx`](../web/src/components/icons.tsx) is drawn on a
24-unit grid with a 1.75 stroke, square caps and mitred joins, to match the drafting line of the
mark. No emoji or Unicode glyphs stand in for icons.

## Motion

- Questions slide in 14px with an exponential ease-out (460ms); going back reverses the direction.
- Ruler ticks ink in as you advance.
- The completion stamp is the one expressive moment.
- `prefers-reduced-motion` disables all of the above.

## Browser surfaces

- Selection is marigold.
- Focus is a ring in ink plus a marigold halo.
- Scrollbars are themed, and the caret is ink.
- Numbers in tables use tabular figures.
