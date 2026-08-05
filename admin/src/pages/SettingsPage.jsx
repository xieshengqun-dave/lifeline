import React from "react";
import { getPlatformFeeSetting, updatePlatformFeeSetting, getOfferTimeoutSetting, updateOfferTimeoutSetting } from "../api/client";

// Not in the original design spec at all — a genuinely new screen. The
// platform fee (flat RM or a %) was previously hardcoded; this is where an
// admin now actually controls it, rather than either number being baked
// into the codebase.
export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [feeType, setFeeType] = React.useState("flat");
  const [feeValue, setFeeValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [saved, setSaved] = React.useState(false);

  const [timeoutSeconds, setTimeoutSeconds] = React.useState("");
  const [timeoutSaving, setTimeoutSaving] = React.useState(false);
  const [timeoutSaved, setTimeoutSaved] = React.useState(false);
  const [timeoutError, setTimeoutError] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [s, t] = await Promise.all([getPlatformFeeSetting(), getOfferTimeoutSetting()]);
        setFeeType(s.feeType);
        setFeeValue(String(s.feeValue));
        setTimeoutSeconds(String(t.seconds));
      } catch (err) {
        setError(err.message || "Could not load settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveTimeout() {
    setTimeoutSaving(true);
    setTimeoutError(null);
    setTimeoutSaved(false);
    try {
      const t = await updateOfferTimeoutSetting(parseInt(timeoutSeconds, 10));
      setTimeoutSeconds(String(t.seconds));
      setTimeoutSaved(true);
    } catch (err) {
      setTimeoutError(err.message || "Could not save (allowed range: 15–300 seconds).");
    } finally {
      setTimeoutSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const value = parseFloat(feeValue);
      await updatePlatformFeeSetting({ feeType, feeValue: value });
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="state-box">Loading…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="settings-card">
        <div className="settings-row">
          <label className="settings-label">Platform Fee Type</label>
          <div className="settings-toggle">
            <button className={`settings-toggle-btn ${feeType === "flat" ? "active" : ""}`} onClick={() => setFeeType("flat")}>
              Flat (RM)
            </button>
            <button className={`settings-toggle-btn ${feeType === "percent" ? "active" : ""}`} onClick={() => setFeeType("percent")}>
              Percentage (%)
            </button>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-label">{feeType === "percent" ? "Percentage of fare subtotal" : "Flat amount per trip (RM)"}</label>
          <div className="settings-input-row">
            <input
              className="settings-input"
              type="number"
              step="0.01"
              value={feeValue}
              onChange={(e) => { setFeeValue(e.target.value); setSaved(false); }}
            />
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <button className="settings-save-btn" onClick={save} disabled={saving || !feeValue}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <div className="settings-success">Saved — new bookings will use this fee immediately.</div>}
      </div>

      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-row">
          <label className="settings-label">Operator accept window (seconds)</label>
          <div className="settings-input-row">
            <input
              className="settings-input"
              type="number"
              min="15"
              max="300"
              step="5"
              value={timeoutSeconds}
              onChange={(e) => { setTimeoutSeconds(e.target.value); setTimeoutSaved(false); }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#5b6b73", marginTop: 6 }}>
            How long each operator has to accept before the request moves to the next
            nearest one. Allowed: 15–300s. Applies to offers created after saving —
            offers already counting down keep their timer.
          </div>
        </div>

        {timeoutError && <div className="error-box">{timeoutError}</div>}

        <button
          className="settings-save-btn"
          onClick={saveTimeout}
          disabled={timeoutSaving || !timeoutSeconds}
        >
          {timeoutSaving ? "Saving…" : "Save accept window"}
        </button>
        {timeoutSaved && <div className="settings-success">Saved — next offers use the new window.</div>}
      </div>
    </div>
  );
}
