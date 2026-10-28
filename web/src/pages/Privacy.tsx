import { Brand } from "../components/Brand";
import { PrivacyNotice } from "../components/PrivacyNotice";
import { STUDY } from "../studyInfo";

export default function Privacy() {
  return (
    <div className="shell">
      <header className="survey-top__inner">
        <Brand />
      </header>
      <main className="hero" style={{ paddingTop: 48 }}>
        <p className="eyebrow">Participant information</p>
        <h1 className="display" style={{ margin: "12px 0 16px" }}>
          Privacy &amp; <em>consent</em>
        </h1>
        <p className="lede">{STUDY.subtitle}. Here is exactly what we collect, why, and what we don't.</p>
        <hr className="divider" />
        <PrivacyNotice />
      </main>
      <footer className="footer">{STUDY.course}</footer>
    </div>
  );
}
