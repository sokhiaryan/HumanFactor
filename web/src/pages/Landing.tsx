import { Link } from "react-router-dom";
import { Brand, VitruvianDrawing } from "../components/Brand";
import { IconArrowRight, IconClock, IconEyeOff, IconKey } from "../components/icons";
import { STUDY } from "../studyInfo";

/** Neutral entry point. Participants normally arrive directly at /s/pre or /s/post. */
export default function Landing() {
  return (
    <>
      <header className="masthead">
        <div className="shell masthead__inner">
          <Brand />
        </div>
      </header>
      <main className="shell">
        <div className="poster">
          <div className="poster__copy">
            <h1 className="display">
              The weakest link is a <em>human factor.</em>
            </h1>
            <p className="lede">
              Most scams don't break software; they persuade people. This anonymous study measures how well we recognise
              them before and after our awareness campaign, so we can learn what actually changes.
            </p>

            <div className="facts">
              <div className="fact">
                <div className="fact__value">
                  <IconClock size={18} /> 6–7 min
                </div>
                <div className="fact__label">Each of the two surveys</div>
              </div>
              <div className="fact">
                <div className="fact__value">
                  <IconEyeOff size={18} /> Anonymous
                </div>
                <div className="fact__label">No name, email or login</div>
              </div>
              <div className="fact">
                <div className="fact__value">
                  <IconKey size={18} /> One code
                </div>
                <div className="fact__label">Links your two surveys</div>
              </div>
            </div>

            <div className="choice-grid">
              <Link className="choice choice--primary" to="/s/pre">
                <span className="choice__no">Part 1 · Before the campaign</span>
                <span className="h2">Take the first survey</span>
                <span className="small">Start here if you haven't taken part yet. You'll get a code to keep.</span>
                <span className="choice__arrow row" style={{ gap: 6 }}>
                  Start <IconArrowRight size={16} />
                </span>
              </Link>
              <Link className="choice" to="/s/post">
                <span className="choice__no">Part 2 · After the campaign</span>
                <span className="h2">Take the follow-up</span>
                <span className="small muted">For people who took part 1. Have your code ready.</span>
                <span className="choice__arrow row" style={{ gap: 6 }}>
                  Continue <IconArrowRight size={16} />
                </span>
              </Link>
            </div>
          </div>

          <figure className="plate" aria-label="The HumanFactor emblem: a Vitruvian figure inside a circle and a square">
            <VitruvianDrawing />
            <figcaption className="plate__caption" aria-hidden="true">
              <span>HUMAN / FACTOR</span>
              <span>FIG. 1</span>
            </figcaption>
          </figure>
        </div>
      </main>
      <footer className="shell footer">
        <div className="footer__inner">
          <span>{STUDY.course}</span>
          <Link to="/privacy">Privacy &amp; consent information</Link>
        </div>
      </footer>
    </>
  );
}
