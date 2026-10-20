import React from "react";
import { getPlatformFeeSetting, updatePlatformFeeSetting, getOfferTimeoutSetting, updateOfferTimeoutSetting, getMinBalanceSetting, updateMinBalanceSetting, getCreditLimitSetting, updateCreditLimitSetting, getPayToSetting, updatePayToSetting } from "../api/client";

const MAX_QR_BYTES = 700 * 1024;
const EMPTY_PAY_TO = { accountName: "", bankName: "", accountNumber: "", instructions: "", qrImage: null };

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

  const [minBalance, setMinBalance] = React.useState("");
  const [minBalanceSaving, setMinBalanceSaving] = React.useState(false);
  const [minBalanceSaved, setMinBalanceSaved] = React.useState(false);
  const [minBalanceError, setMinBalanceError] = React.useState(null);

  const [creditLimit, setCreditLimit] = React.useState("");
  const [creditSaving, setCreditSaving] = React.useState(false);
  const [creditSaved, setCreditSaved] = React.useState(false);
  const [creditError, setCreditError] = React.useState(null);

  const [payTo, setPayTo] = React.useState(EMPTY_PAY_TO);
  const [payToSaving, setPayToSaving] = React.useState(false);
  const [payToSaved, setPayToSaved] = React.useState(false);
  const [payToError, setPayToError] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [s, t, m, c, p] = await Promise.all([
          getPlatformFeeSetting(),
          getOfferTimeoutSetting(),
          getMinBalanceSetting(),
          getCreditLimitSetting(),
          getPayToSetting(),
        ]);
        setFeeType(s.feeType);
        setFeeValue(String(s.feeValue));
        setTimeoutSeconds(String(t.seconds));
        setMinBalance(String(m.amount));
        setCreditLimit(String(c.amount));
        setPayTo({
          accountName: p.accountName || "",
          bankName: p.bankName || "",
          accountNumber: p.accountNumber || "",
          instructions: p.instructions || "",
          qrImage: p.qrImage,
        });
      } catch (err) {
        setError(err.message || "Could not load settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveCreditLimit() {
    setCreditSaving(true);
    setCreditError(null);
    setCreditSaved(false);
    try {
      const c = await updateCreditLimitSetting(parseFloat(creditLimit));
      setCreditLimit(String(c.amount));
      setCreditSaved(true);
    } catch (err) {
      setCreditError(err.message || "Could not save (allowed range: RM0–100,000).");
    } finally {
      setCreditSaving(false);
    }
  }

  function editPayTo(field, value) {
    setPayTo((p) => ({ ...p, [field]: value }));
    setPayToSaved(false);
  }

  function pickQr(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setPayToError("QR must be a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_QR_BYTES) {
      setPayToError("QR image is too large — keep it under 700 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPayToError(null);
      editPayTo("qrImage", reader.result);
    };
    reader.onerror = () => setPayToError("Could not read that image.");
    reader.readAsDataURL(file);
  }

  async function savePayTo() {
    setPayToSaving(true);
    setPayToError(null);
    setPayToSaved(false);
    try {
      const p = await updatePayToSetting(payTo);
      setPayTo({
        accountName: p.accountName || "",
        bankName: p.bankName || "",
        accountNumber: p.accountNumber || "",
        instructions: p.instructions || "",
        qrImage: p.qrImage,
      });
      setPayToSaved(true);
    } catch (err) {
      setPayToError(err.message || "Could not save payment details.");
    } finally {
      setPayToSaving(false);
    }
  }

  async function saveMinBalance() {
    setMinBalanceSaving(true);
    setMinBalanceError(null);
    setMinBalanceSaved(false);
    try {
      const m = await updateMinBalanceSetting(parseFloat(minBalance));
      setMinBalance(String(m.amount));
      setMinBalanceSaved(true);
    } catch (err) {
      setMinBalanceError(err.message || "Could not save (allowed range: RM0–1000).");
    } finally {
      setMinBalanceSaving(false);
    }
  }

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

      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-row">
          <label className="settings-label">Minimum wallet balance to go online (RM)</label>
          <div className="settings-input-row">
            <input
              className="settings-input"
              type="number"
              min="0"
              max="1000"
              step="10"
              value={minBalance}
              onChange={(e) => { setMinBalance(e.target.value); setMinBalanceSaved(false); }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#5b6b73", marginTop: 6 }}>
            Operators whose available credit (balance + credit limit) is below this
            can't flip themselves online (enforced server-side). Set 0 to disable. The
            per-job rule still applies either way: an operator never receives a job whose
            platform fee their available credit can't cover.
          </div>
        </div>

        {minBalanceError && <div className="error-box">{minBalanceError}</div>}

        <button
          className="settings-save-btn"
          onClick={saveMinBalance}
          disabled={minBalanceSaving || minBalance === ""}
        >
          {minBalanceSaving ? "Saving…" : "Save minimum balance"}
        </button>
        {minBalanceSaved && <div className="settings-success">Saved — applies the next time an operator tries to go online.</div>}
      </div>

      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-row">
          <label className="settings-label">Monthly billing — credit limit per operator (RM)</label>
          <div className="settings-input-row">
            <input
              className="settings-input"
              type="number"
              min="0"
              max="100000"
              step="50"
              value={creditLimit}
              onChange={(e) => { setCreditLimit(e.target.value); setCreditSaved(false); }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#5b6b73", marginTop: 6 }}>
            Patients pay operators directly, and platform fees are billed monthly. This
            is how much an operator may owe before they stop receiving new jobs; they
            start again once their payment is recorded. Set 0 for prepaid only
            (operators must top up before working).
          </div>
        </div>

        {creditError && <div className="error-box">{creditError}</div>}

        <button
          className="settings-save-btn"
          onClick={saveCreditLimit}
          disabled={creditSaving || creditLimit === ""}
        >
          {creditSaving ? "Saving…" : "Save credit limit"}
        </button>
        {creditSaved && <div className="settings-success">Saved — applies to the next quotes and offers.</div>}
      </div>

      <div className="settings-card" style={{ marginTop: 18 }}>
        <div className="settings-label" style={{ marginBottom: 4 }}>Where operators pay their monthly bill</div>
        <div style={{ fontSize: 12, color: "#5b6b73", marginBottom: 12 }}>
          Shown in the operator app under Wallet → How to pay. Leave a field blank to hide it.
        </div>

        <div className="settings-row">
          <label className="settings-label">Account name</label>
          <input className="settings-input" style={{ width: "100%" }} value={payTo.accountName} maxLength={120}
            placeholder="e.g. Lifeline Sdn Bhd" onChange={(e) => editPayTo("accountName", e.target.value)} />
        </div>
        <div className="settings-row">
          <label className="settings-label">Bank</label>
          <input className="settings-input" style={{ width: "100%" }} value={payTo.bankName} maxLength={80}
            placeholder="e.g. Maybank" onChange={(e) => editPayTo("bankName", e.target.value)} />
        </div>
        <div className="settings-row">
          <label className="settings-label">Account number</label>
          <input className="settings-input" style={{ width: "100%" }} value={payTo.accountNumber} maxLength={40}
            onChange={(e) => editPayTo("accountNumber", e.target.value)} />
        </div>
        <div className="settings-row">
          <label className="settings-label">Instructions</label>
          <textarea className="settings-input" style={{ width: "100%", minHeight: 64 }} value={payTo.instructions} maxLength={500}
            placeholder="e.g. Use your operator name and month as the reference. Pay by the 7th."
            onChange={(e) => editPayTo("instructions", e.target.value)} />
        </div>
        <div className="settings-row">
          <label className="settings-label">DuitNow QR (PNG or JPEG, under 700 KB)</label>
          {payTo.qrImage && (
            <img src={payTo.qrImage} alt="Company DuitNow QR" style={{ display: "block", width: 160, height: 160, objectFit: "contain", border: "1px solid var(--color-line)", borderRadius: 10, marginBottom: 8 }} />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <label className="btn btn-outline" style={{ cursor: "pointer" }}>
              {payTo.qrImage ? "Replace QR" : "Upload QR"}
              <input type="file" accept="image/png,image/jpeg" onChange={pickQr} style={{ display: "none" }} />
            </label>
            {payTo.qrImage && (
              <button className="btn btn-outline" onClick={() => editPayTo("qrImage", null)}>Remove QR</button>
            )}
          </div>
        </div>

        {payToError && <div className="error-box">{payToError}</div>}

        <button className="settings-save-btn" onClick={savePayTo} disabled={payToSaving}>
          {payToSaving ? "Saving…" : "Save payment details"}
        </button>
        {payToSaved && <div className="settings-success">Saved — operators see these details now.</div>}
      </div>
    </div>
  );
}
