import React from "react";
import { getBilling, getOperatorStatement } from "../api/client";
import { formatMoney, formatDateTime } from "../lib/format";

// Monthly operator billing (decided 2026-10-20). Patients pay operators
// directly; each trip's platform fee accrues in the operator's wallet as a
// negative balance. At month end: open an operator's statement, print or save
// it as PDF, send it to them, and record their bank transfer in the Operators
// drawer (Wallet → Payment received).

const TX_LABEL = {
  service_fee: "Platform fee",
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
              <div className="statement-title">Lifeline — Platform fee statement</div>
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
            <div><span>Platform fees ({data.trips} trip{data.trips === 1 ? "" : "s"})</span><span>−{formatMoney(data.fees)}</span></div>
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
            Patients pay operators directly for each trip. This statement covers only Lifeline's
            platform fees. A negative balance is the amount owed to Lifeline.
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const [month, setMonth] = React.useState(thisMonth);
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [viewing, setViewing] = React.useState(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    getBilling(month)
      .then(setData)
      .catch((err) => setError(err.message || "Could not load billing."))
      .finally(() => setLoading(false));
  }, [month]);

  React.useEffect(() => { if (!viewing) load(); }, [load, viewing]);

  if (viewing) return <Statement operatorId={viewing} month={month} onBack={() => setViewing(null)} />;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
        <input
          className="settings-input"
          type="month"
          value={month}
          max={thisMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </div>

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
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Fees ({monthLabel(month)})</div>
              <div className="kpi-value tone-teal">{formatMoney(data.totals.fees)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Payments received</div>
              <div className="kpi-value">{formatMoney(data.totals.payments)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Due at month end</div>
              <div className="kpi-value">{formatMoney(data.totals.amountDue)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Owed right now</div>
              <div className="kpi-value tone-red">{formatMoney(data.totals.currentAmountOwed)}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Trips</th>
                  <th>Fees</th>
                  <th>Payments</th>
                  <th>Closing balance</th>
                  <th>Amount due</th>
                  <th>Owed now</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.operators.map((r) => (
                  <tr key={r.operatorId}>
                    <td>
                      <div>{r.name}</div>
                      <div className="operator-row-sub">{r.email}</div>
                    </td>
                    <td>{r.trips}</td>
                    <td>{formatMoney(r.fees)}</td>
                    <td>{formatMoney(r.payments)}</td>
                    <td>{formatMoney(r.closingBalance)}</td>
                    <td style={{ fontWeight: 700, color: r.amountDue > 0 ? "var(--color-red)" : undefined }}>
                      {formatMoney(r.amountDue)}
                    </td>
                    <td>{formatMoney(r.currentAmountOwed)}</td>
                    <td>
                      <button className="btn btn-outline" onClick={() => setViewing(r.operatorId)}>Statement</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: "#5b6b73", marginTop: 12 }}>
            Record an operator's bank transfer in Operators → their drawer → Wallet → "Payment received".
            "Amount due" is the balance at the end of the selected month; "Owed now" is today's balance.
          </div>
        </>
      )}
    </div>
  );
}
