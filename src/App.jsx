
import {
  createBrowserRouter,
  RouterProvider,
  Routes,
  Route,
} from "react-router-dom";

import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Files from "./pages/Files";
import Shared from "./pages/Shared";
import Recent from "./pages/Recent";
import Trash from "./pages/Trash";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Favorites from "./pages/Favorites";
import Documents from "./pages/Documents";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AppLayout from "./components/AppLayout";
import NovaLoader from "./components/NovaLoader";
import Office from "./pages/Office";
import { NavigationGuardProvider } from "./context/NavigationGuardContext";

import "./styles/theme.css";
import "./styles/components.css";
import "./styles/pages.css";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <NovaLoader />;
  }

  return user ? (
    <NavigationGuardProvider>
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
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/documents/:documentId" element={<Documents />} />
          <Route path="/office" element={<Office />} />
        </Routes>
      </AppLayout>
    </NavigationGuardProvider>
  ) : (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

const router = createBrowserRouter([
  {
    path: "*",
    element: <AppContent />,
  },
]);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
