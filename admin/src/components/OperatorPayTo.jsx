import React from "react";
import { getOperatorPayTo, updateOperatorPayTo } from "../api/client";

// Where PATIENTS pay this operator (drawer section): the operator's own bank
// details and DuitNow QR. Patients see it in their app once the operator
// accepts, and the crew can show the QR from the operator app. Only the back
// office can change it — check the name on the QR matches the operator
// before saving, because this is where patients' money goes.

const MAX_QR_BYTES = 700 * 1024;
const EMPTY = { accountName: "", bankName: "", accountNumber: "", instructions: "", qrImage: null };

const toForm = (p) => ({
  accountName: p.accountName || "",
  bankName: p.bankName || "",
  accountNumber: p.accountNumber || "",
  instructions: p.instructions || "",
  qrImage: p.qrImage || null,
});

export default function OperatorPayTo({ operatorId, operatorName }) {
  const [form, setForm] = React.useState(EMPTY);
  const [loaded, setLoaded] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [checked, setChecked] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    setLoaded(false);
    setForm(EMPTY);
    setDirty(false);
    setChecked(false);
    setSaved(false);
    setError(null);
    getOperatorPayTo(operatorId)
      .then((p) => { if (!dead) { setForm(toForm(p)); setLoaded(true); } })
      .catch((err) => { if (!dead) { setError(err.message || "Could not load payment details."); setLoaded(true); } });
    return () => { dead = true; };
  }, [operatorId]);

  function edit(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function pickQr(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) { setError("QR must be a PNG or JPEG image."); return; }
    if (file.size > MAX_QR_BYTES) { setError("QR image is too large — keep it under 700 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setError(null); edit("qrImage", reader.result); setChecked(false); };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  const hasAny = !!(form.accountName || form.bankName || form.accountNumber || form.instructions || form.qrImage);

  async function save() {
    if (hasAny && !checked) { setError("Confirm the account and QR belong to this operator first."); return; }
    setSaving(true);
    setError(null);
    try {
      setForm(toForm(await updateOperatorPayTo(operatorId, form)));
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save payment details.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="rate-card-box">Loading payment details…</div>;

  return (
    <div className="rate-card-box">
      {!hasAny && !dirty && (
        <div className="notice-box" style={{ marginBottom: 10 }}>
          Nothing on file — patients are told to pay the crew in cash.
        </div>
      )}
      <div className="wallet-form">
        <input className="wallet-form-wide" placeholder="Account name" value={form.accountName} maxLength={120}
          onChange={(e) => edit("accountName", e.target.value)} disabled={saving} />
        <input placeholder="Bank" value={form.bankName} maxLength={80}
          onChange={(e) => edit("bankName", e.target.value)} disabled={saving} />
        <input placeholder="Account number" value={form.accountNumber} maxLength={40}
          onChange={(e) => edit("accountNumber", e.target.value)} disabled={saving} />
        <input className="wallet-form-wide" placeholder="Note to patients (optional)" value={form.instructions} maxLength={500}
          onChange={(e) => edit("instructions", e.target.value)} disabled={saving} />
      </div>
      {form.qrImage && <img className="payto-qr" src={form.qrImage} alt={`${operatorName} DuitNow QR`} />}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <label className="btn btn-outline" style={{ cursor: "pointer", flex: 1, textAlign: "center" }}>
          {form.qrImage ? "Replace QR" : "Upload DuitNow QR"}
          <input type="file" accept="image/png,image/jpeg" onChange={pickQr} style={{ display: "none" }} />
        </label>
        {form.qrImage && (
          <button className="btn btn-outline" disabled={saving} onClick={() => edit("qrImage", null)}>Remove</button>
        )}
      </div>
      {dirty && hasAny && (
        <label className="payto-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>I checked that this account and QR belong to {operatorName}.</span>
        </label>
      )}
      {error && <div className="error-box" style={{ marginBottom: 8 }}>{error}</div>}
      <button className="btn btn-primary drawer-btn" style={{ width: "100%" }} disabled={saving || !dirty} onClick={save}>
        {saving ? "Saving…" : "Save payment details"}
      </button>
      {saved && <div className="settings-success">Saved — patients see these details once this operator accepts a trip.</div>}
    </div>
  );
}
