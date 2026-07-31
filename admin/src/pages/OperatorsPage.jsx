import React from "react";
import { getOperators, createOperator, updateOperator, approveOperator, suspendOperator, getOperatorWallet, applyWalletTransaction } from "../api/client";
import { formatMoney } from "../lib/format";
import StatusBadge from "../components/StatusBadge";

const TONE_BY_STATUS = { approved: "good", suspended: "bad", pending: "pending" };
const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
];

const EMPTY_FORM = {
  name: "", email: "", password: "", phone: "", address: "",
  baseLat: "", baseLng: "", serviceRadiusKm: "10", baseFare: "", perKmRate: "",
};

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function toEditForm(op) {
  return {
    name: op.name, phone: op.phone || "", address: op.address || "",
    baseLat: String(op.baseLat), baseLng: String(op.baseLng),
    serviceRadiusKm: String(op.serviceRadiusKm), baseFare: String(op.baseFare), perKmRate: String(op.perKmRate),
  };
}

export default function OperatorsPage() {
  const [loading, setLoading] = React.useState(true);
  const [operators, setOperators] = React.useState([]);
  const [loadError, setLoadError] = React.useState(null);
  const [actionError, setActionError] = React.useState(null);
  const [pendingActionId, setPendingActionId] = React.useState(null);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(null);
  const [mode, setMode] = React.useState("view"); // view | edit | create
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [formError, setFormError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [walletTx, setWalletTx] = React.useState([]);
  const [walletForm, setWalletForm] = React.useState({ type: "topup", amount: "", note: "" });
  const [walletError, setWalletError] = React.useState(null);
  const [walletBusy, setWalletBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await getOperators();
      setOperators(data);
      setLoadError(null);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err) {
      setLoadError(err.message || "Could not load operators.");
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  React.useEffect(() => {
    if (!selectedId) return;
    let dead = false;
    setWalletTx([]);
    setWalletError(null);
    getOperatorWallet(selectedId)
      .then((w) => { if (!dead) setWalletTx(w.transactions); })
      .catch((err) => { if (!dead) setWalletError(err.message || "Could not load wallet."); });
    return () => { dead = true; };
  }, [selectedId]);

  async function submitWalletTx(operatorId) {
    const raw = Number(walletForm.amount);
    if (!Number.isFinite(raw) || raw === 0) { setWalletError("Enter a non-zero amount."); return; }
    if (!walletForm.note.trim() || walletForm.note.trim().length < 3) {
      setWalletError("A note is required (e.g. bank transfer reference).");
      return;
    }
    // topup is always a credit, withdrawal always a debit; adjustment as typed.
    const amount =
      walletForm.type === "topup" ? Math.abs(raw)
      : walletForm.type === "withdrawal" ? -Math.abs(raw)
      : raw;
    setWalletBusy(true);
    setWalletError(null);
    try {
      const row = await applyWalletTransaction(operatorId, { type: walletForm.type, amount, note: walletForm.note.trim() });
      setWalletTx((prev) => [row, ...prev]);
      setOperators((prev) => prev.map((o) => (o.id === operatorId ? { ...o, walletBalance: row.balanceAfter } : o)));
      setWalletForm({ type: "topup", amount: "", note: "" });
    } catch (err) {
      setWalletError(err.message || "Wallet update failed.");
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleApprove(id) {
    setPendingActionId(id);
    setActionError(null);
    try {
      const updated = await approveOperator(id);
      setOperators((prev) => prev.map((op) => (op.id === id ? { ...op, ...updated } : op)));
    } catch (err) {
      setActionError(err.message || "Could not approve operator.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleSuspend(id) {
    setPendingActionId(id);
    setActionError(null);
    try {
      const updated = await suspendOperator(id);
      setOperators((prev) => prev.map((op) => (op.id === id ? { ...op, ...updated } : op)));
    } catch (err) {
      setActionError(err.message || "Could not suspend operator.");
    } finally {
      setPendingActionId(null);
    }
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setMode("create");
  }

  function startEdit(op) {
    setForm(toEditForm(op));
    setFormError(null);
    setMode("edit");
  }

  function cancelForm() {
    setMode("view");
    setFormError(null);
  }

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submitCreate() {
    setSaving(true);
    setFormError(null);
    try {
      const created = await createOperator({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        address: form.address || undefined,
        baseLat: parseFloat(form.baseLat),
        baseLng: parseFloat(form.baseLng),
        serviceRadiusKm: form.serviceRadiusKm ? parseFloat(form.serviceRadiusKm) : undefined,
        baseFare: parseFloat(form.baseFare),
        perKmRate: parseFloat(form.perKmRate),
      });
      setOperators((prev) => [...prev, created]);
      setSelectedId(created.id);
      setMode("view");
    } catch (err) {
      setFormError(err.message || "Could not create operator.");
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(id) {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updateOperator(id, {
        name: form.name,
        phone: form.phone || undefined,
        address: form.address || undefined,
        baseLat: parseFloat(form.baseLat),
        baseLng: parseFloat(form.baseLng),
        serviceRadiusKm: parseFloat(form.serviceRadiusKm),
        baseFare: parseFloat(form.baseFare),
        perKmRate: parseFloat(form.perKmRate),
      });
      setOperators((prev) => prev.map((op) => (op.id === id ? { ...op, ...updated } : op)));
      setMode("view");
    } catch (err) {
      setFormError(err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    all: operators.length,
    pending: operators.filter((o) => o.vettingStatus === "pending").length,
    approved: operators.filter((o) => o.vettingStatus === "approved").length,
    suspended: operators.filter((o) => o.vettingStatus === "suspended").length,
  };

  const filtered = operators
    .filter((o) => filter === "all" || o.vettingStatus === filter)
    .filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  const selected = operators.find((o) => o.id === selectedId) || null;
  const busy = pendingActionId === selectedId;

  const formFields = (
    <>
      {mode === "create" && (
        <>
          <label className="settings-label">Email</label>
          <input className="settings-input" style={{ marginBottom: 14 }} value={form.email} onChange={(e) => setField("email", e.target.value)} />
          <label className="settings-label">Password</label>
          <input className="settings-input" style={{ marginBottom: 14 }} type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} />
        </>
      )}
      <label className="settings-label">Name</label>
      <input className="settings-input" style={{ marginBottom: 14 }} value={form.name} onChange={(e) => setField("name", e.target.value)} />
      <label className="settings-label">Phone</label>
      <input className="settings-input" style={{ marginBottom: 14 }} value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
      <label className="settings-label">Address</label>
      <input className="settings-input" style={{ marginBottom: 14 }} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="e.g. 12 Jalan SS15/4, Subang Jaya, Selangor" />
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="settings-label">Base latitude</label>
          <input className="settings-input" type="number" step="0.0001" value={form.baseLat} onChange={(e) => setField("baseLat", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="settings-label">Base longitude</label>
          <input className="settings-input" type="number" step="0.0001" value={form.baseLng} onChange={(e) => setField("baseLng", e.target.value)} />
        </div>
      </div>
      <label className="settings-label">Service radius (km)</label>
      <input className="settings-input" style={{ marginBottom: 14 }} type="number" value={form.serviceRadiusKm} onChange={(e) => setField("serviceRadiusKm", e.target.value)} />
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="settings-label">Base dispatch (RM)</label>
          <input className="settings-input" type="number" step="0.01" value={form.baseFare} onChange={(e) => setField("baseFare", e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="settings-label">Per km (RM)</label>
          <input className="settings-input" type="number" step="0.01" value={form.perKmRate} onChange={(e) => setField("perKmRate", e.target.value)} />
        </div>
      </div>
    </>
  );

  return (
    <div className="operators-shell">
      <div className="operators-list-col">
        <div className="page-header operators-header">
          <div>
            <h1 className="page-title">Operators</h1>
            <div className="page-subline">
              {counts.all} total
              {counts.pending > 0 && <span className="subline-amber"> · {counts.pending} pending review</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="search-box"
              placeholder="Search operators…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" onClick={startCreate}>+ Add Operator</button>
          </div>
        </div>

        <div className="filter-chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-chip ${filter === f.key ? "active" : ""} ${f.key === "pending" ? "chip-amber" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>

        {actionError && <div className="error-box">{actionError}</div>}

        {loading ? (
          <div className="state-box">Loading…</div>
        ) : loadError ? (
          <div className="state-box">
            {loadError}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-outline" onClick={load}>Retry</button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="state-box">No operators match.</div>
        ) : (
          <div className="operator-rows">
            {filtered.map((op) => (
              <button
                key={op.id}
                className={`operator-row-card ${selectedId === op.id ? "selected" : ""} ${op.vettingStatus === "suspended" ? "dimmed" : ""}`}
                onClick={() => { setSelectedId(op.id); setMode("view"); }}
              >
                <div className="operator-avatar">{initials(op.name)}</div>
                <div className="operator-row-main">
                  <div className="operator-row-name">{op.name}</div>
                  <div className="operator-row-sub">{op.tripCount} trips · {op.fleetSummary || "no fleet on file"}</div>
                </div>
                <div className="operator-row-rating">{op.ratingAvg != null ? `★ ${op.ratingAvg.toFixed(1)}` : "—"}</div>
                <StatusBadge tone={TONE_BY_STATUS[op.vettingStatus]} label={op.vettingStatus} />
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === "create" && (
        <div className="operator-drawer">
          <div className="drawer-name" style={{ marginBottom: 18 }}>Add Operator</div>
          {formError && <div className="error-box">{formError}</div>}
          {formFields}
          <div className="drawer-actions">
            <button className="btn btn-primary drawer-btn" disabled={saving} onClick={submitCreate}>
              {saving ? "Creating…" : "Create"}
            </button>
            <button className="btn btn-outline drawer-btn" disabled={saving} onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "edit" && selected && (
        <div className="operator-drawer">
          <div className="drawer-name" style={{ marginBottom: 18 }}>Edit {selected.name}</div>
          {formError && <div className="error-box">{formError}</div>}
          {formFields}
          <div className="drawer-actions">
            <button className="btn btn-primary drawer-btn" disabled={saving} onClick={() => submitEdit(selected.id)}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-outline drawer-btn" disabled={saving} onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {mode === "view" && selected && (
        <div className="operator-drawer">
          <div className="drawer-header">
            <div className="operator-avatar operator-avatar-lg">{initials(selected.name)}</div>
            <div>
              <div className="drawer-name">{selected.name}</div>
              <div className="drawer-sub">{selected.vettingStatus === "pending" ? "Pending review" : selected.vettingStatus}</div>
            </div>
          </div>

          <div className="drawer-section-title">COMPANY DETAILS</div>
          <div className="drawer-detail-row"><span>Email</span><span>{selected.email}</span></div>
          <div className="drawer-detail-row"><span>Contact</span><span>{selected.phone || "—"}</span></div>
          <div className="drawer-detail-row"><span>Address</span><span>{selected.address || "—"}</span></div>
          <div className="drawer-detail-row"><span>Base location</span><span>{selected.baseLat.toFixed(3)}, {selected.baseLng.toFixed(3)}</span></div>
          <div className="drawer-detail-row"><span>Service radius</span><span>{selected.serviceRadiusKm} km</span></div>

          <div className="drawer-section-title">RATE CARD</div>
          <div className="rate-card-box">
            <div className="drawer-detail-row"><span>Base dispatch</span><span>{formatMoney(selected.baseFare)}</span></div>
            <div className="drawer-detail-row"><span>Per km</span><span>{formatMoney(selected.perKmRate)}</span></div>
          </div>

          <div className="drawer-section-title">WALLET</div>
          <div className="rate-card-box">
            <div className="drawer-detail-row">
              <span>Balance</span>
              <span style={{ fontWeight: 700, color: (selected.walletBalance ?? 0) < 30 ? "#c0392b" : undefined }}>
                {formatMoney(selected.walletBalance ?? 0)}
              </span>
            </div>
            {walletError && <div className="error-box" style={{ marginTop: 8 }}>{walletError}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <select
                value={walletForm.type}
                onChange={(e) => setWalletForm((f) => ({ ...f, type: e.target.value }))}
                disabled={walletBusy}
                style={{ flex: "0 0 110px" }}
              >
                <option value="topup">Top-up</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="adjustment">Adjustment</option>
              </select>
              <input
                type="number"
                placeholder="RM"
                value={walletForm.amount}
                onChange={(e) => setWalletForm((f) => ({ ...f, amount: e.target.value }))}
                disabled={walletBusy}
                style={{ flex: "0 0 90px" }}
              />
              <input
                type="text"
                placeholder="Note / transfer ref"
                value={walletForm.note}
                onChange={(e) => setWalletForm((f) => ({ ...f, note: e.target.value }))}
                disabled={walletBusy}
                style={{ flex: 1 }}
              />
            </div>
            <button
              className="btn btn-primary drawer-btn"
              style={{ marginTop: 8, width: "100%" }}
              disabled={walletBusy}
              onClick={() => submitWalletTx(selected.id)}
            >
              {walletBusy ? "Applying…" : "Apply to wallet"}
            </button>
            {walletTx.slice(0, 6).map((t) => (
              <div key={t.id} className="drawer-detail-row" style={{ fontSize: 12 }}>
                <span>{t.type.replace("_", " ")}{t.note ? ` · ${t.note.slice(0, 26)}` : ""}</span>
                <span style={{ color: t.amount >= 0 ? "#1e8e5a" : "#c0392b" }}>
                  {t.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>

          <div className="drawer-section-title">FLEET · {selected.ambulanceCount} UNIT{selected.ambulanceCount === 1 ? "" : "S"}</div>
          <div className="drawer-detail-row"><span>Summary</span><span>{selected.fleetSummary || "—"}</span></div>
          <div className="drawer-detail-row"><span>Rating</span><span>{selected.ratingAvg != null ? `★ ${selected.ratingAvg.toFixed(1)} (${selected.ratingCount})` : "No ratings yet"}</span></div>

          <div className="drawer-actions">
            <button className="btn btn-outline drawer-btn" disabled={busy} onClick={() => startEdit(selected)}>
              Edit
            </button>
            {selected.vettingStatus !== "approved" && (
              <button className="btn btn-primary drawer-btn" disabled={busy} onClick={() => handleApprove(selected.id)}>
                Approve
              </button>
            )}
            {selected.vettingStatus !== "suspended" && (
              <button className="btn btn-outline drawer-btn" disabled={busy} onClick={() => handleSuspend(selected.id)}>
                Suspend
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
