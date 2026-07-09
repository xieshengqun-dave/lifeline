import React from "react";
import { getAuthToken, setAuthToken, setUnauthorizedHandler } from "./api/client";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import OperatorsPage from "./pages/OperatorsPage";
import BookingsPage from "./pages/BookingsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const [token, setToken] = React.useState(() => getAuthToken());
  const [view, setView] = React.useState("operators");

  const signOut = React.useCallback(() => {
    setAuthToken(null);
    setToken(null);
  }, []);

  React.useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, [signOut]);

  if (!token) {
    return (
      <LoginPage
        onLogin={(t) => {
          setAuthToken(t);
          setToken(t);
        }}
      />
    );
  }

  return (
    <Layout view={view} onNavigate={setView} onLogout={signOut}>
      {view === "operators" && <OperatorsPage />}
      {view === "bookings" && <BookingsPage />}
      {view === "settings" && <SettingsPage />}
      {view === "analytics" && <div className="page state-box">Analytics — coming in a later phase.</div>}
    </Layout>
  );
}
