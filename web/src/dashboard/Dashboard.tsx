// Team analytics dashboard (route /team). Protected by the server: every /api/admin/*
// call needs the signed session cookie, and a 401 at any point returns to the login screen.

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import type { AnalyticsReport } from "../../../shared/types";
import { api, ApiRequestError } from "../api";
import { Brand } from "../components/Brand";
import "./dashboard.css";
import { time } from "./format";
import { IconLogout, IconPrint, IconRefresh } from "../components/icons";
import { AnswerKey, Comparison, EmptyState, Exports, Overview, Perception, Questions, Sample, Withdraw } from "./sections";

const POLL_MS = 15_000;
const DEMO_KEY = "hlac:includeDemo";

const VIEWS = [
  { id: "overview", label: "Overview", data: true },
  { id: "comparison", label: "PRE vs POST", data: true },
  { id: "questions", label: "Questions", data: true },
  { id: "perception", label: "Perception", data: true },
  { id: "sample", label: "Sample", data: true },
  { id: "exports", label: "Exports", data: false },
  { id: "key", label: "Answer key", data: false },
  { id: "withdraw", label: "Withdrawal", data: false },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

function readDemoPref(): boolean {
  try {
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDemoPref(v: boolean) {
  try {
    sessionStorage.setItem(DEMO_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

type AuthState = "checking" | "login" | "ready";

export default function Dashboard() {
  const [auth, setAuth] = useState<AuthState>("checking");

  useEffect(() => {
    document.title = "Team dashboard — HumanFactor";
    api("/admin/me")
      .then(() => setAuth("ready"))
      .catch(() => setAuth("login"));
  }, []);

  if (auth === "checking") return <div className="page-loading" aria-busy="true" />;
  if (auth === "login") return <Login onSuccess={() => setAuth("ready")} />;
  return <Workspace onUnauthorized={() => setAuth("login")} onLogout={() => setAuth("login")} />;
}

// --- Login ---------------------------------------------------------------------------------

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await api("/admin/login", { method: "POST", json: { password } });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(
          err.status === 429
            ? "Too many attempts. Wait a few minutes before trying again."
            : err.code === "admin_disabled"
              ? "The dashboard is disabled: ADMIN_PASSWORD isn't configured on the server. See the README."
              : err.message,
        );
      } else setError("Sign-in failed.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <div className="login__card card card--pad">
        <Brand suffix="Team" />
        <h1 className="login__title">Team dashboard</h1>
        <p className="muted small">Results and exports for the project team. Participants never see this page.</p>
        <form onSubmit={submit} className="stack" style={{ ["--gap" as string]: "14px" }}>
          <div className="field">
            <label htmlFor="admin-password">Team password</label>
            <input
              id="admin-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              autoFocus
            />
          </div>
          {error && (
            <div id="login-error" className="notice notice--bad" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn--primary btn--lg login__submit" type="submit" disabled={busy || !password}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

// --- Workspace -------------------------------------------------------------------------------

function Workspace({ onUnauthorized, onLogout }: { onUnauthorized: () => void; onLogout: () => void }) {
  const [params, setParams] = useSearchParams();
  const view: ViewId = (VIEWS.find((v) => v.id === params.get("view"))?.id ?? "overview") as ViewId;
  const [includeDemo, setIncludeDemo] = useState(readDemoPref);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const inflight = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++inflight.current;
    setLoading(true);
    try {
      const r = await api<AnalyticsReport>(`/admin/analytics?includeDemo=${includeDemo ? 1 : 0}`);
      if (ticket !== inflight.current) return; // a newer request superseded this one
      setReport(r);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) return onUnauthorized();
      if (ticket === inflight.current) setError(err instanceof Error ? err.message : "Could not load analytics.");
    } finally {
      if (ticket === inflight.current) setLoading(false);
    }
  }, [includeDemo, onUnauthorized]);

  // Initial load, polling (paused while the tab is hidden) and refresh on focus.
  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Printing renders every data section, fully expanded.
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const toggleDemo = (v: boolean) => {
    setIncludeDemo(v);
    writeDemoPref(v);
  };

  const logout = async () => {
    try {
      await api("/admin/logout", { method: "POST" });
    } finally {
      onLogout();
    }
  };

  const go = (id: ViewId) => {
    setParams(id === "overview" ? {} : { view: id }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  const demoOn = !!report?.includesDemo;
  const isDemoInstance = report?.instance === "demo";
  const showDemoToggle = !!report && (report.demoResponsesInDatabase > 0 || includeDemo);
  const isEmpty = !!report && report.overview.totalResponses === 0;
  const activeView = VIEWS.find((v) => v.id === view)!;

  const renderData = (id: ViewId) => {
    if (!report) return null;
    switch (id) {
      case "overview":
        return <Overview r={report} />;
      case "comparison":
        return <Comparison r={report} />;
      case "questions":
        return <Questions r={report} expandAll={printing} />;
      case "perception":
        return <Perception r={report} />;
      case "sample":
        return <Sample r={report} />;
      default:
        return null;
    }
  };

  return (
    <div className={`dash ${demoOn ? "dash--demo" : ""}`}>
      <a href="#dash-main" className="skip-link">
        Skip to content
      </a>
      <header className="dash-top masthead">
        <div className="shell shell--wide dash-top__inner">
          <Brand to="/team" suffix="Team" />
          {isDemoInstance && (
            <span
              className="pill pill--accent instance-pill"
              title="Generated by npm run demo:seed into a separate demo database. These are not real participants."
              aria-describedby="instance-note"
            >
              <span className="hide-sm">Synthetic demonstration dataset</span>
              <span className="show-sm">Demo data</span>
            </span>
          )}
          <span className="spacer" />
          <div className="dash-status" aria-live="polite">
            {loading && !report ? (
              "Loading…"
            ) : updatedAt ? (
              <>
                <span className={`live-dot ${loading ? "live-dot--busy" : ""}`} aria-hidden="true" />
                <span className="dash-status__text">Updated {time(updatedAt)}</span>
              </>
            ) : null}
          </div>
          <button type="button" className="btn btn--sm" onClick={load} disabled={loading} aria-label="Refresh data">
            <span className={`btn-icon ${loading ? "spin" : ""}`}>
              <IconRefresh size={16} />
            </span>
            <span className="hide-sm">Refresh</span>
          </button>
          <button type="button" className="btn btn--sm hide-sm" onClick={() => window.print()}>
            <IconPrint size={16} />
            Print report
          </button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={logout} aria-label="Sign out">
            <IconLogout size={16} />
            <span className="hide-xs">Sign out</span>
          </button>
        </div>
        <nav className="dash-nav" aria-label="Dashboard sections">
          <div className="shell shell--wide dash-nav__inner">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className="dash-tab"
                aria-current={view === v.id ? "page" : undefined}
                onClick={() => go(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </nav>
        {demoOn && (
          <div className="demo-banner" role="alert">
            <div className="shell shell--wide demo-banner__inner">
              <strong>DEMONSTRATION DATA — not real participants.</strong>
              <span className="hide-sm">Figures below include generated demo responses. Never report them.</span>
              <button type="button" className="btn btn--sm demo-banner__off" onClick={() => toggleDemo(false)}>
                Hide demo data
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="dash-main" className="shell shell--wide dash-main">
        <div className="print-header">
          <h1>HumanFactor — results report</h1>
          <p>
            Generated {report ? new Date(report.generatedAt).toLocaleString() : ""}
            {isDemoInstance ? " · SYNTHETIC DEMONSTRATION DATASET — NOT REAL PARTICIPANTS" : ""}
            {demoOn ? " · INCLUDES DEMONSTRATION DATA — NOT REAL PARTICIPANTS" : ""}
          </p>
        </div>

        {isDemoInstance && (
          <p id="instance-note" className="instance-note no-print">
            This dashboard is running on a synthetic demonstration dataset generated by <span className="mono">npm run demo:seed</span>. The
            responses are modelled, not collected from real participants.
          </p>
        )}

        {(showDemoToggle || error) && (
          <div className="dash-controls no-print">
            {showDemoToggle && (
              <label className="switch">
                <input type="checkbox" checked={includeDemo} onChange={(e) => toggleDemo(e.target.checked)} />
                <span className="switch__track" aria-hidden="true">
                  <span className="switch__thumb" />
                </span>
                <span>
                  Include demonstration data
                  <span className="muted tiny switch__hint">
                    {report?.demoResponsesInDatabase ?? 0} demo response{report?.demoResponsesInDatabase === 1 ? "" : "s"} in the database
                  </span>
                </span>
              </label>
            )}
            {error && (
              <div className="notice notice--warn" role="status">
                {error} {report ? "Showing the last loaded data." : ""}
              </div>
            )}
          </div>
        )}

        {!report && !error && <div className="skeleton skeleton--tall" aria-busy="true" />}

        {report &&
          (printing ? (
            isEmpty ? (
              <EmptyState />
            ) : (
              VIEWS.filter((v) => v.data).map((v) => (
                <section key={v.id} className="dash-view dash-view--print">
                  {renderData(v.id)}
                </section>
              ))
            )
          ) : (
            <section className="dash-view" aria-label={activeView.label} key={view}>
              {activeView.data ? (
                isEmpty ? (
                  <EmptyState />
                ) : (
                  renderData(view)
                )
              ) : view === "exports" ? (
                <Exports includeDemo={includeDemo} demoInstance={report?.instance === "demo"} />
              ) : view === "key" ? (
                <AnswerKey onUnauthorized={onUnauthorized} />
              ) : (
                <Withdraw onDone={load} onUnauthorized={onUnauthorized} />
              )}
            </section>
          ))}
      </main>
    </div>
  );
}
