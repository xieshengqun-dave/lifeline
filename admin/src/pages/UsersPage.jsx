import React from "react";
import { getAdminUsers, createAdminUser, updateAdminUser } from "../api/client";

const MIN_PASSWORD = 10;
const EMPTY = { email: "", name: "", password: "" };

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
}

// Admin accounts. Every admin has the same powers, so anyone here can add or
// disable anyone else; the backend refuses to disable the last enabled
// account (or your own), so the console can't lock everybody out.
export default function UsersPage() {
  const [users, setUsers] = React.useState([]);
  const [currentId, setCurrentId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [form, setForm] = React.useState(EMPTY);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await getAdminUsers();
      setUsers(data.users);
      setCurrentId(data.currentAdminUserId);
    } catch (err) {
      setError(err.message || "Could not load admin users.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function addUser(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (form.password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    try {
      await createAdminUser({ email: form.email.trim(), name: form.name.trim(), password: form.password });
      setForm(EMPTY);
      setNotice(`${form.email.trim()} can now sign in with that password.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisabled(user) {
    setError(null);
    setNotice(null);
    try {
      await updateAdminUser(user.id, { disabled: !user.disabled });
      await load();
    } catch (err) {
      setError(err.message || "Could not update the account.");
    }
  }

  async function resetPassword(user) {
    const next = window.prompt(`New password for ${user.email} (at least ${MIN_PASSWORD} characters):`);
    if (next === null) return;
    if (next.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setError(null);
    try {
      await updateAdminUser(user.id, { password: next });
      setNotice(`Password updated for ${user.email}. Share it with them directly.`);
    } catch (err) {
      setError(err.message || "Could not reset the password.");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Admin Users</div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="notice-box" style={{ marginBottom: 14 }}>{notice}</div>}

      <form className="users-add-form" onSubmit={addUser}>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          type="password"
          placeholder={`Password (${MIN_PASSWORD}+ characters)`}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add admin"}
        </button>
      </form>

      {loading ? (
        <div className="state-box">Loading…</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Last signed in</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    {u.id === currentId && <span className="users-you-tag">you</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>{formatDate(u.lastLoginAt)}</td>
                  <td>
                    <span className={`badge ${u.disabled ? "badge-bad" : "badge-good"}`}>
                      {u.disabled ? "DISABLED" : "ACTIVE"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-outline" onClick={() => resetPassword(u)}>Reset password</button>
                    <button
                      className="btn btn-outline"
                      style={{ marginLeft: 8 }}
                      disabled={u.id === currentId}
                      title={u.id === currentId ? "You cannot disable your own account" : undefined}
                      onClick={() => toggleDisabled(u)}
                    >
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="state-box">
                    No admin accounts yet — add the first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
