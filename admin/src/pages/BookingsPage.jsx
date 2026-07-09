import React from "react";
import { getBookings } from "../api/client";
import { formatMoney } from "../lib/format";
import StatusBadge from "../components/StatusBadge";

const TONE_BY_STATUS = {
  completed: "good",
  accepted: "good",
  enroute: "good",
  arrived: "good",
  onboard: "good",
  cancelled: "bad",
  expired: "bad",
  declined: "pending",
  offered: "pending",
  requested: "neutral",
};

const STAGE_LABELS = {
  requested: "Requested", offered: "Awaiting accept", accepted: "Accepted",
  enroute: "En route", arrived: "Arrived", onboard: "Onboard",
  completed: "Completed", cancelled: "Cancelled", declined: "Declined", expired: "No units — 999",
};

const ACTIVE_STATUSES = ["accepted", "enroute", "arrived", "onboard"];
const POLL_INTERVAL_MS = 8000;
const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7days", label: "7 days", days: 7 },
  { key: "all", label: "All", days: null },
];

function initials(name) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function BookingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [bookings, setBookings] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [refreshFailing, setRefreshFailing] = React.useState(false);
  const [range, setRange] = React.useState("today");
  const [tick, setTick] = React.useState(Date.now());

  const load = React.useCallback(async (isInitial) => {
    try {
      const data = await getBookings();
      setBookings(data);
      setError(null);
      setRefreshFailing(false);
    } catch (err) {
      const message = err.message || "Network error";
      if (isInitial) {
        setError(message);
      } else {
        // Keep showing last-known rows rather than blanking the table on a
        // transient background-poll failure (e.g. a brief backend restart).
        setRefreshFailing(true);
      }
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const initial = async () => {
      await load(true);
      if (!cancelled) setLoading(false);
    };
    initial();

    const poll = () => load(false);
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener("focus", poll);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", poll);
    };
  }, [load]);

  // Independent 1s tick purely for the live "Offer · m:ss" per-row countdown
  // — the 8s network poll above is unrelated to this display-only timer.
  React.useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const rangeSpec = RANGES.find((r) => r.key === range);
  const cutoff = rangeSpec.days ? Date.now() - rangeSpec.days * 86400000 : 0;
  const inRange = bookings.filter((b) => new Date(b.createdAt).getTime() >= cutoff);

  const activeNow = inRange.filter((b) => ACTIVE_STATUSES.includes(b.status)).length;
  const completedCount = inRange.filter((b) => b.status === "completed").length;
  const fallbackCount = inRange.filter((b) => b.status === "expired").length;

  const acceptTimes = inRange
    .flatMap((b) => b.offers || [])
    .filter((o) => o.status === "accepted" && o.respondedAt)
    .map((o) => (new Date(o.respondedAt).getTime() - new Date(o.offeredAt).getTime()) / 1000);
  const avgAcceptSeconds = acceptTimes.length ? Math.round(acceptTimes.reduce((a, b) => a + b, 0) / acceptTimes.length) : null;

  function stageContent(b) {
    if (b.status === "offered") {
      const pending = (b.offers || []).find((o) => o.status === "pending");
      if (pending) {
        const remaining = Math.max(0, Math.floor((new Date(pending.expiresAt).getTime() - tick) / 1000));
        const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
        const ss = String(remaining % 60).padStart(2, "0");
        return `Offer · ${mm}:${ss}`;
      }
    }
    return STAGE_LABELS[b.status] || b.status;
  }

  function rowAccentClass(b) {
    if (ACTIVE_STATUSES.includes(b.status)) return "row-accent-teal";
    if (b.status === "offered") return "row-accent-amber";
    return "";
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">
          Bookings
          <span className="live-pill"><span className="live-dot" /> LIVE</span>
        </h1>
        <div className="range-chips">
          {RANGES.map((r) => (
            <button key={r.key} className={`range-chip ${range === r.key ? "active" : ""}`} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {refreshFailing && <div className="notice-box">Couldn't refresh — retrying…</div>}

      {loading ? (
        <div className="state-box">Loading…</div>
      ) : error ? (
        <div className="state-box">
          {error}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-outline" onClick={() => load(true)}>Retry</button>
          </div>
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Active now</div>
              <div className="kpi-value tone-teal">{activeNow}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Completed ({rangeSpec.label.toLowerCase()})</div>
              <div className="kpi-value">{completedCount}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg. accept time</div>
              <div className="kpi-value">{avgAcceptSeconds != null ? `${avgAcceptSeconds}s` : "—"}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">999 fallbacks</div>
              <div className="kpi-value tone-red">{fallbackCount}</div>
            </div>
          </div>

          {inRange.length === 0 ? (
            <div className="state-box">No bookings in this range.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Route</th>
                    <th>Operator</th>
                    <th>Stage</th>
                    <th>Fare</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inRange.map((b) => (
                    <tr key={b.id} className={rowAccentClass(b)}>
                      <td>
                        <div>#{b.id.slice(-6).toUpperCase()}</div>
                        <div className="operator-row-sub">{new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td>{b.pickupName} → {b.destinationName}</td>
                      <td>
                        {b.operator ? (
                          <div className="operator-cell">
                            <div className="operator-cell-avatar">{initials(b.operator.name)}</div>
                            {b.operator.name}
                          </div>
                        ) : (
                          <span className="awaiting-text">Awaiting accept…</span>
                        )}
                      </td>
                      <td><StatusBadge tone={TONE_BY_STATUS[b.status] || "neutral"} label={stageContent(b)} /></td>
                      <td>{formatMoney(b.total ?? b.subtotal)}</td>
                      <td><StatusBadge tone={TONE_BY_STATUS[b.status] || "neutral"} label={b.status === "expired" ? "999" : b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
