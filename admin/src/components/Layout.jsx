import lifelineMark from "../assets/brand/lifeline-mark.png";

const NAV_ITEMS = [
  { key: "operators", label: "Operators" },
  { key: "bookings", label: "Bookings" },
  { key: "settings", label: "Settings" },
  { key: "analytics", label: "Analytics" }, // placeholder — not designed yet, matches the design's own framing
];

export default function Layout({ view, onNavigate, onLogout, children }) {
  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-tile">
            <img src={lifelineMark} alt="" />
          </div>
          <span className="sidebar-brand-name">Lifeline</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`sidebar-nav-btn ${view === item.key ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-avatar">A</div>
          <div>
            <div className="sidebar-footer-label">Admin</div>
          </div>
          <button className="logout-btn" onClick={onLogout}>Sign Out</button>
        </div>
      </div>
      <div className="content-area">{children}</div>
    </div>
  );
}
