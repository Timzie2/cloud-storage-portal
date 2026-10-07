import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Files from "./pages/Files";
import Shared from "./pages/Shared";
import Recent from "./pages/Recent";
import Trash from "./pages/Trash";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AppLayout from "./components/AppLayout";
import NovaLoader from "./components/NovaLoader";

import "./styles/theme.css";
import "./styles/components.css";
import "./styles/pages.css";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <NovaLoader />;
  }

  return (
    <BrowserRouter>
      {user ? (
        <AppLayout>
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  onViewAll={() => {
                    window.location.href = "/files";
                  }}
                />
              }
            />

            <Route path="/files" element={<Files />} />
            <Route path="/shared" element={<Shared />} />
            <Route path="/recent" element={<Recent />} />
            <Route path="/trash" element={<Trash />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </AppLayout>
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<Home />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;