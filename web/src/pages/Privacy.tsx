import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { PrivacyNotice } from "../components/PrivacyNotice";
import { STUDY } from "../studyInfo";

export default function Privacy() {
  return (
    <>
      <header className="masthead">
        <div className="shell masthead__inner">
          <Brand />
        </div>
      </header>
      <main className="shell shell--narrow" style={{ padding: "48px 20px 24px" }}>
        <h1 className="display display--sm">
          Privacy &amp; <em>consent</em>
        </h1>
        <p className="lede" style={{ marginTop: 18 }}>
          {STUDY.subtitle}. Here is exactly what we collect, why, and what we don't.
        </p>
        <hr className="divider" />
        <PrivacyNotice />
      </main>
      <footer className="shell shell--narrow footer">
        <div className="footer__inner">
          <span>{STUDY.course}</span>
          <Link to="/">Back to HumanFactor</Link>
        </div>
      </footer>
    </>
  );
}
