import React from "react";
import { setAuthToken, getOperators, ApiError } from "../api/client";
import lifelineMark from "../assets/brand/lifeline-mark.png";

// There's no dedicated "verify token" endpoint on the backend (and shouldn't
// be, per Phase 4's zero-new-endpoints scope) — validate by making one real
// admin call and only flip to logged-in on success, so a bad token never
// lands the user on a blank/broken OperatorsPage.
//
// The design mock shows separate Email + Password fields, but the real
// mechanism here is a single shared admin token (no admin user table) —
// splitting one token into two fake inputs would misrepresent what's
// actually being checked, so this stays a single labeled field restyled to
// match the card/shadow/gradient treatment, not a literal copy of the mock.
export default function LoginPage({ onLogin }) {
  const [tokenInput, setTokenInput] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    setAuthToken(tokenInput.trim());
    try {
      await getOperators();
      onLogin(tokenInput.trim());
    } catch (err) {
      setAuthToken(null);
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid admin token.");
      } else {
        setError(err.message || "Could not reach the server.");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-panel">
        <div className="login-panel-brand">
          <div className="login-panel-tile">
            <img src={lifelineMark} alt="" />
          </div>
          <div>
            <div className="login-panel-brand-name">Lifeline</div>
            <div className="login-panel-brand-sub">Admin Console</div>
          </div>
        </div>
        <div>
          <div className="login-panel-tagline">Every second counts.</div>
          <div className="login-panel-copy">
            Vet operators and monitor live dispatch across the Klang Valley.
          </div>
        </div>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-title">Sign in</div>
        <div className="login-subtitle">Authorised administrators only.</div>

        {error && <div className="error-box">{error}</div>}

        <label className="login-label">Admin Token</label>
        <div className="login-field">
          <input
            className="login-input"
            type="password"
            placeholder="••••••••••••"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            autoFocus
          />
        </div>

        <button className="login-btn" type="submit" disabled={checking || !tokenInput}>
          {checking ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
