import React from "react";
import { setAuthToken, adminLogin, getOperators, ApiError } from "../api/client";
import lifelineMark from "../assets/brand/lifeline-mark.png";

// Two ways in (2026-09-18):
//  • Email + password — a real AdminUser account, the normal path.
//  • The shared ADMIN_API_TOKEN — break-glass access, and the only way in
//    before the first account exists (sign in with it, then add yourself on
//    the Users page). Validated by making one real admin call, since there's
//    no token-verify endpoint: a bad token must never land on a broken page.
export default function LoginPage({ onLogin }) {
  const [mode, setMode] = React.useState("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [tokenInput, setTokenInput] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      if (mode === "password") {
        const { token } = await adminLogin(email.trim(), password);
        onLogin(token);
      } else {
        setAuthToken(tokenInput.trim());
        await getOperators();
        onLogin(tokenInput.trim());
      }
    } catch (err) {
      setAuthToken(null);
      if (err instanceof ApiError && (err.status === 401 || err.status === 429)) {
        setError(err.message);
      } else {
        setError(err.message || "Could not reach the server.");
      }
    } finally {
      setChecking(false);
    }
  }

  const disabled = checking || (mode === "password" ? !email || !password : !tokenInput);

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

        {mode === "password" ? (
          <>
            <label className="login-label">Email</label>
            <div className="login-field">
              <input
                className="login-input"
                type="email"
                autoComplete="username"
                placeholder="you@lifeline.test"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <label className="login-label">Password</label>
            <div className="login-field">
              <input
                className="login-input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        <button className="login-btn" type="submit" disabled={disabled}>
          {checking ? "Checking…" : "Sign in"}
        </button>

        <button
          type="button"
          className="login-alt-btn"
          onClick={() => {
            setMode((m) => (m === "password" ? "token" : "password"));
            setError(null);
          }}
        >
          {mode === "password" ? "Use admin token instead" : "Back to email sign-in"}
        </button>
      </form>
    </div>
  );
}
