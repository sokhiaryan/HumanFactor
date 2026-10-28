import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { IconArrowRight, IconClock, IconEyeOff } from "../components/icons";
import { STUDY } from "../studyInfo";

/** Neutral entry point. Participants normally arrive directly at /s/pre or /s/post. */
export default function Landing() {
  return (
    <div className="shell">
      <header className="survey-top__inner">
        <Brand />
      </header>
      <main className="hero">
        <p className="eyebrow">{STUDY.course}</p>
        <h1 className="display" style={{ margin: "14px 0 18px" }}>
          Can you spot <em>the hook?</em>
        </h1>
        <p className="lede">
          {STUDY.subtitle}. Two short, anonymous surveys — one before our awareness campaign and one after — help us find
          out what actually changes.
        </p>

        <div className="choice-grid">
          <Link className="choice" to="/s/pre">
            <span className="pill">Part 1 · Before</span>
            <span className="h2">First survey</span>
            <span className="muted small">
              Take this if you haven't done the survey before. You'll get an anonymous code to keep.
            </span>
            <span className="choice__arrow row" style={{ gap: 6 }}>
              Start <IconArrowRight size={16} />
            </span>
          </Link>
          <Link className="choice" to="/s/post">
            <span className="pill pill--accent">Part 2 · After</span>
            <span className="h2">Follow-up survey</span>
            <span className="muted small">For people who took part in the first survey. Have your code ready.</span>
            <span className="choice__arrow row" style={{ gap: 6 }}>
              Continue <IconArrowRight size={16} />
            </span>
          </Link>
        </div>

        <div className="row muted small" style={{ marginTop: 28, gap: 20 }}>
          <span className="row" style={{ gap: 6 }}>
            <IconClock size={16} /> About 6–7 minutes each
          </span>
          <span className="row" style={{ gap: 6 }}>
            <IconEyeOff size={16} /> No name or email
          </span>
        </div>
      </main>
      <footer className="footer">
        <Link to="/privacy">Privacy &amp; consent information</Link>
      </footer>
    </div>
  );
}
