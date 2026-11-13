import React from "react";
import { getOperatorFleet, createAmbulance, updateAmbulance, createCrew, updateCrew } from "../api/client";

// Fleet & crew for one operator (drawer section). Operators can manage
// their own in the operator app; this is the same data, for onboarding a
// new operator or fixing a mistake. Nothing is deleted — past trips point
// at these rows — so "remove" is Deactivate, which hides it from trip
// assignment. An operator needs one active ambulance and one active crew
// member before patients can see them.

const AMBULANCE_TYPES = ["ALS", "BLS", "NEONATAL"];
const CREW_ROLES = ["PARAMEDIC", "DRIVER"];
const ROLE_LABEL = { PARAMEDIC: "Paramedic", DRIVER: "Driver" };

export default function OperatorFleet({ operatorId, onChanged }) {
  const [fleet, setFleet] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [ambForm, setAmbForm] = React.useState({ plate: "", type: "BLS" });
  const [crewForm, setCrewForm] = React.useState({ name: "", role: "PARAMEDIC", phone: "" });

  const load = React.useCallback(async () => {
    try {
      setFleet(await getOperatorFleet(operatorId));
      setError(null);
    } catch (err) {
      setError(err.message || "Could not load the fleet.");
    }
  }, [operatorId]);

  React.useEffect(() => {
    setFleet(null);
    setAmbForm({ plate: "", type: "BLS" });
    setCrewForm({ name: "", role: "PARAMEDIC", phone: "" });
    load();
  }, [load]);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  function addAmbulance() {
    if (!ambForm.plate.trim()) { setError("Enter the plate number."); return; }
    run(async () => {
      await createAmbulance(operatorId, { plate: ambForm.plate, type: ambForm.type });
      setAmbForm({ plate: "", type: "BLS" });
    });
  }

  function addCrew() {
    if (crewForm.name.trim().length < 2) { setError("Enter the crew member's name."); return; }
    run(async () => {
      await createCrew(operatorId, { name: crewForm.name, role: crewForm.role, phone: crewForm.phone });
      setCrewForm({ name: "", role: "PARAMEDIC", phone: "" });
    });
  }

  if (!fleet) return <div className="rate-card-box">{error ? <div className="error-box">{error}</div> : "Loading fleet…"}</div>;

  const activeAmbulances = fleet.ambulances.filter((a) => a.active).length;
  const activeCrew = fleet.crew.filter((c) => c.active).length;

  return (
    <div className="rate-card-box">
      {(activeAmbulances === 0 || activeCrew === 0) && (
        <div className="notice-box" style={{ marginBottom: 10 }}>
          Patients can't see this operator until it has at least one active ambulance and one active crew member.
        </div>
      )}
      {error && <div className="error-box" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="fleet-subtitle">Ambulances</div>
      {fleet.ambulances.length === 0 && <div className="fleet-empty">None yet.</div>}
      {fleet.ambulances.map((a) => (
        <div key={a.id} className={`fleet-row ${a.active ? "" : "fleet-row-off"}`}>
          <span className="fleet-row-main">{a.plate} · {a.type}{a.active ? "" : " · inactive"}</span>
          <button className="fleet-link" disabled={busy} onClick={() => run(() => updateAmbulance(operatorId, a.id, { active: !a.active }))}>
            {a.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ))}
      <div className="wallet-form">
        <input placeholder="Plate, e.g. WXY 1234" value={ambForm.plate} maxLength={15} disabled={busy}
          onChange={(e) => setAmbForm((f) => ({ ...f, plate: e.target.value }))} />
        <select value={ambForm.type} disabled={busy} onChange={(e) => setAmbForm((f) => ({ ...f, type: e.target.value }))}>
          {AMBULANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <button className="btn btn-outline drawer-btn" style={{ width: "100%" }} disabled={busy} onClick={addAmbulance}>
        Add ambulance
      </button>

      <div className="fleet-subtitle" style={{ marginTop: 14 }}>Crew</div>
      {fleet.crew.length === 0 && <div className="fleet-empty">None yet.</div>}
      {fleet.crew.map((c) => (
        <div key={c.id} className={`fleet-row ${c.active ? "" : "fleet-row-off"}`}>
          <span className="fleet-row-main">
            {c.name} · {ROLE_LABEL[c.role] || c.role}{c.phone ? ` · ${c.phone}` : ""}{c.active ? "" : " · inactive"}
          </span>
          <button className="fleet-link" disabled={busy} onClick={() => run(() => updateCrew(operatorId, c.id, { active: !c.active }))}>
            {c.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ))}
      <div className="wallet-form">
        <input placeholder="Name" value={crewForm.name} maxLength={80} disabled={busy}
          onChange={(e) => setCrewForm((f) => ({ ...f, name: e.target.value }))} />
        <select value={crewForm.role} disabled={busy} onChange={(e) => setCrewForm((f) => ({ ...f, role: e.target.value }))}>
          {CREW_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <input className="wallet-form-wide" placeholder="Phone (optional)" value={crewForm.phone} maxLength={20} disabled={busy}
          onChange={(e) => setCrewForm((f) => ({ ...f, phone: e.target.value }))} />
      </div>
      <button className="btn btn-outline drawer-btn" style={{ width: "100%" }} disabled={busy} onClick={addCrew}>
        Add crew member
      </button>
    </div>
  );
}
