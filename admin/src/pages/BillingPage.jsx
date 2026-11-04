import React from "react";
import { getBilling, getOperatorStatement, updateOperatorBilling } from "../api/client";
import { formatMoney, formatDateTime } from "../lib/format";
import StatusBadge from "../components/StatusBadge";

// Operator billing — SaaS subscription (2026-11-04). Patients pay operators
// directly; each approved operator is charged a monthly subscription on the
// 1st, due by the due day, and auto-paused (hidden from patients) when still
// unpaid after the grace days. Here: see who owes what, open/print a
// statement, and pause or resume an operator. Payments are recorded in the
// Operators drawer (Wallet → Payment received).

const TX_LABEL = {
  subscription: "Monthly subscription",
  service_fee: "Trip platform fee (old model)",
  topup: "Payment received",
  adjustment: "Adjustment",
  withdrawal: "Withdrawal",
  trip_earning: "Trip fare (prepaid)",
};

function thisMonth() {
  // Malaysia time (UTC+8), to match the server's month boundaries.
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 7);
}

function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Statement({ operatorId, month, onBack }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let dead = false;
    getOperatorStatement(operatorId, month)
      .then((s) => !dead && setData(s))
      .catch((err) => !dead && setError(err.message || "Could not load statement."));
    return () => { dead = true; };
  }, [operatorId, month]);

  return (
    <div className="page">
      <div className="page-header no-print">
        <button className="btn btn-outline" onClick={onBack}>← Back to billing</button>
        {data && <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>}
      </div>

      {error ? (
        <div className="error-box">{error}</div>
      ) : !data ? (
        <div className="state-box">Loading…</div>
      ) : (
        <div className="statement">
          <div className="statement-head">
            <div>
              <div className="statement-title">Lifeline — Subscription statement</div>
              <div className="statement-sub">{monthLabel(month)}</div>
            </div>
            <div className="statement-to">
              <div style={{ fontWeight: 700 }}>{data.operator.name}</div>
              {data.operator.email && <div>{data.operator.email}</div>}
              {data.operator.phone && <div>{data.operator.phone}</div>}
            </div>
          </div>

          <div className="statement-summary">
            <div><span>Opening balance</span><span>{formatMoney(data.openingBalance)}</span></div>
            <div><span>Monthly subscription</span><span>−{formatMoney(data.subscription)}</span></div>
            {data.tripFees > 0 && <div><span>Trip platform fees (old model)</span><span>−{formatMoney(data.tripFees)}</span></div>}
            <div><span>Payments received</span><span>+{formatMoney(data.payments)}</span></div>
            {data.other !== 0 && <div><span>Adjustments</span><span>{data.other > 0 ? "+" : "−"}{formatMoney(Math.abs(data.other))}</span></div>}
            <div className="statement-total"><span>Closing balance</span><span>{formatMoney(data.closingBalance)}</span></div>
            <div className="statement-due"><span>Amount due</span><span>{formatMoney(data.amountDue)}</span></div>
          </div>

          <table className="statement-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ textAlign: "right" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 ? (
                <tr><td colSpan={4} style={{ color: "var(--color-faint)" }}>No activity this month.</td></tr>
              ) : (
                data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDateTime(t.createdAt)}</td>
                    <td className="statement-desc">
                      {TX_LABEL[t.type] || t.type}
                      {t.booking ? ` · ${t.booking.pickupName} → ${t.booking.destinationName} (#${t.bookingId.slice(-6).toUpperCase()})` : t.note ? ` · ${t.note}` : ""}
                    </td>
                    <td style={{ textAlign: "right" }}>{t.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(t.amount))}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(t.balanceAfter)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="statement-foot">
            Patients pay operators directly for each trip; Lifeline takes no commission. This
            statement covers your Lifeline subscription. A negative balance is the amount owed.
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_TONE = { paid: "good", due: "pending", overdue: "bad", paused: "bad" };

function shortDate(iso) {
  // dueAt/pauseAt are the instants a day ENDS in MYT; show the day itself.
  return new Date(new Date(iso).getTime() - 1).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function BillingPage() {
  const [month, setMonth] = React.useState(thisMonth);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [viewing, setViewing] = React.useState(null);
  const [busyId, setBusyId] = React.useState(null);
  const [actionError, setActionError] = React.useState(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    getBilling(month)
      .then(setData)
      .catch((err) => setError(err.message || "Could not load billing."))
      .finally(() => setLoading(false));
  }, [month]);

  React.useEffect(() => { if (!viewing) load(); }, [load, viewing]);

  async function toggleHold(row) {
    setBusyId(row.operatorId);
    setActionError(null);
    try {
      await updateOperatorBilling(row.operatorId, { billingHold: !row.billingHold });
      load();
    } catch (err) {
      setActionError(err.message || "Could not update the operator.");
    } finally {
      setBusyId(null);
    }
  }

  if (viewing) return <Statement operatorId={viewing} month={month} onBack={() => setViewing(null)} />;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
        <input
          className="settings-input"
          style={{ flex: "none" }}
          type="month"
          value={month}
          max={thisMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </div>

      {actionError && <div className="error-box">{actionError}</div>}

      {loading ? (
        <div className="state-box">Loading…</div>
      ) : error ? (
        <div className="state-box">
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-outline" onClick={load}>Retry</button>
          </div>
        </div>
      ) : (
        <>
          {data.settings.price <= 0 && (
            <div className="notice-box">
              The subscription price is RM0, so nobody is being charged. Set it in Settings → Operator subscription.
            </div>
          )}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Charged ({monthLabel(month)})</div>
              <div className="kpi-value tone-teal">{formatMoney(data.totals.charges)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Payments received</div>
              <div className="kpi-value">{formatMoney(data.totals.payments)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Owed right now</div>
              <div className="kpi-value tone-red">{formatMoney(data.totals.currentAmountOwed)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Paused operators</div>
              <div className="kpi-value tone-red">{data.totals.paused}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Plan / month</th>
                  <th>Charged</th>
                  <th>Payments</th>
                  <th>Owed now</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.operators.map((r) => (
                  <tr key={r.operatorId}>
                    <td>
                      <div>{r.name}</div>
                      <div className="operator-row-sub">{r.email}{r.vettingStatus !== "approved" ? ` · ${r.vettingStatus}` : ""}</div>
                    </td>
                    <td>
                      {formatMoney(r.price)}
                      {r.customPrice != null && <div className="operator-row-sub">custom price</div>}
                    </td>
                    <td>{formatMoney(r.charges)}</td>
                    <td>{formatMoney(r.payments)}</td>
                    <td style={{ fontWeight: 700, color: r.currentAmountOwed > 0 ? "var(--color-red)" : undefined }}>
                      {formatMoney(r.currentAmountOwed)}
                    </td>
                    <td>
                      <StatusBadge
                        tone={STATUS_TONE[r.status] || "neutral"}
                        label={r.status === "paused" ? `paused${r.billingHoldReason === "overdue" ? " · unpaid" : ""}` : r.status}
                      />
                    </td>
                    <td>
                      <div className="action-group">
                        <button className="btn btn-outline" onClick={() => setViewing(r.operatorId)}>Statement</button>
                        <button
                          className={`btn ${r.billingHold ? "btn-primary" : "btn-outline"}`}
                          disabled={busyId === r.operatorId}
                          onClick={() => toggleHold(r)}
                        >
                          {r.billingHold ? "Resume" : "Pause"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: "#5b6b73", marginTop: 12 }}>
            {monthLabel(month)}: due by {shortDate(data.dueAt)}; unpaid operators are paused automatically after{" "}
            {shortDate(data.pauseAt)}. Record a bank transfer in Operators → drawer → Wallet → "Payment received" —
            an automatic pause lifts once nothing is owed. "Pause" hides an operator from patients until you resume them.
          </div>
        </>
      )}
    </div>
  );
}
