import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Brand } from "./components/Brand";
import Landing from "./pages/Landing";
import Privacy from "./pages/Privacy";
import Survey from "./pages/Survey";

// The dashboard is loaded on demand, so participants never download its code.
const Dashboard = lazy(() => import("./dashboard/Dashboard"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/s/pre" element={<Survey stage="pre" />} />
      <Route path="/s/post" element={<Survey stage="post" />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route
        path="/team/*"
        element={
          <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
            <Dashboard />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <>
      <header className="masthead">
        <div className="shell masthead__inner">
          <Brand />
        </div>
      </header>
      <main className="shell shell--narrow center-stack">
        <h1 className="display display--sm">This page isn't on the form.</h1>
        <p className="muted">Check the link you were given, or go back to the start.</p>
        <Link className="btn btn--primary" to="/">
          Go to the start
        </Link>
      </main>
    </>
  );
}
