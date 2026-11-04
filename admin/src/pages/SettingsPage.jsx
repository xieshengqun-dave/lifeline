import React from "react";
import { getOfferTimeoutSetting, updateOfferTimeoutSetting, getSubscriptionSetting, updateSubscriptionSetting, getPayToSetting, updatePayToSetting } from "../api/client";

const MAX_QR_BYTES = 700 * 1024;
const EMPTY_PAY_TO = { accountName: "", bankName: "", accountNumber: "", instructions: "", qrImage: null };

// Not in the original design spec at all — a genuinely new screen. Since the
// SaaS model (2026-11-04) it holds the operator subscription (price, due day,
// grace days) instead of the old per-trip platform fee / minimum balance /
// credit limit, plus the accept window and where operators pay.
export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const [sub, setSub] = React.useState({ price: "", dueDay: "", graceDays: "" });
  const [subSaving, setSubSaving] = React.useState(false);
  const [subSaved, setSubSaved] = React.useState(false);
  const [subError, setSubError] = React.useState(null);

  const [timeoutSeconds, setTimeoutSeconds] = React.useState("");
  const [timeoutSaving, setTimeoutSaving] = React.useState(false);
  const [timeoutSaved, setTimeoutSaved] = React.useState(false);
  const [timeoutError, setTimeoutError] = React.useState(null);

  const [payTo, setPayTo] = React.useState(EMPTY_PAY_TO);
  const [payToSaving, setPayToSaving] = React.useState(false);
  const [payToSaved, setPayToSaved] = React.useState(false);
  const [payToError, setPayToError] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [t, subRes, p] = await Promise.all([
          getOfferTimeoutSetting(),
          getSubscriptionSetting(),
          getPayToSetting(),
        ]);
        setTimeoutSeconds(String(t.seconds));
        setSub({ price: String(subRes.price), dueDay: String(subRes.dueDay), graceDays: String(subRes.graceDays) });
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

  async function saveSubscription() {
    setSubSaving(true);
    setSubError(null);
    setSubSaved(false);
    try {
      const r = await updateSubscriptionSetting({
        price: parseFloat(sub.price),
        dueDay: parseInt(sub.dueDay, 10),
        graceDays: parseInt(sub.graceDays, 10),
      });
      setSub({ price: String(r.price), dueDay: String(r.dueDay), graceDays: String(r.graceDays) });
      setSubSaved(true);
    } catch (err) {
      setSubError(err.message || "Could not save (due day 1–28, grace 0–60 days).");
    } finally {
      setSubSaving(false);
    }
  }

  function editSub(field, value) {
    setSub((x) => ({ ...x, [field]: value }));
    setSubSaved(false);
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

      {error && <div className="error-box">{error}</div>}

      <div className="settings-card">
        <div className="settings-label" style={{ marginBottom: 4 }}>Operator subscription</div>
        <div style={{ fontSize: 12, color: "#5b6b73", marginBottom: 12 }}>
          Patients pay operators directly and Lifeline charges no trip fee. Each approved
          operator is charged this monthly subscription on the 1st (from the month after
          approval). A custom price per operator can be set in Operators → drawer. RM0 = not
          charging yet.
        </div>
        <div className="settings-row">
          <label className="settings-label">Monthly price (RM)</label>
          <input className="settings-input" type="number" min="0" step="10" value={sub.price}
            onChange={(e) => editSub("price", e.target.value)} />
        </div>
        <div className="settings-row">
          <label className="settings-label">Due by day of the month (1–28)</label>
          <input className="settings-input" type="number" min="1" max="28" step="1" value={sub.dueDay}
            onChange={(e) => editSub("dueDay", e.target.value)} />
        </div>
        <div className="settings-row">
          <label className="settings-label">Grace days before pausing (0–60)</label>
          <input className="settings-input" type="number" min="0" max="60" step="1" value={sub.graceDays}
            onChange={(e) => editSub("graceDays", e.target.value)} />
          <div style={{ fontSize: 12, color: "#5b6b73", marginTop: 6 }}>
            An operator who still owes money this many days after the due date is paused
            automatically: hidden from patients until you record their payment.
          </div>
        </div>

        {subError && <div className="error-box">{subError}</div>}

        <button
          className="settings-save-btn"
          onClick={saveSubscription}
          disabled={subSaving || sub.price === "" || sub.dueDay === "" || sub.graceDays === ""}
        >
          {subSaving ? "Saving…" : "Save subscription"}
        </button>
        {subSaved && <div className="settings-success">Saved — applies from the next billing run.</div>}
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
        <div className="settings-label" style={{ marginBottom: 4 }}>Where operators pay their subscription</div>
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
