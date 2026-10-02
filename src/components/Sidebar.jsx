import { useEffect, useState } from "react";
import {
  Home,
  Folder,
  Share2,
  Clock3,
  Trash2,
  Settings,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { getStorageQuota } from "../services/storageQuota";

function formatStorage(bytes) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function Sidebar() {
  const { user } = useAuth();

  const [storageQuota, setStorageQuota] = useState(null);

  const navItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/files", label: "My Files", icon: Folder },
    { to: "/shared", label: "Shared", icon: Share2 },
    { to: "/recent", label: "Recent", icon: Clock3 },
    { to: "/trash", label: "Trash", icon: Trash2 },
  ];

  useEffect(() => {
    if (!user) {
      setStorageQuota(null);
      return;
    }

    let isMounted = true;

    const loadQuota = async () => {
      try {
        const quota = await getStorageQuota(user.id);

        if (isMounted) {
          setStorageQuota(quota);
        }
      } catch (error) {
        console.error(
          "Failed to load sidebar storage quota:",
          error
        );
      }
    };

    // Load immediately
    loadQuota();

    // Listen for instant updates from the app
    const handleQuotaUpdate = (event) => {
      if (event.detail) {
        setStorageQuota(event.detail);
      } else {
        loadQuota();
      }
    };

    window.addEventListener(
      "storage-quota-updated",
      handleQuotaUpdate
    );

    // Fallback: keep quota synced with Supabase
    const interval = setInterval(() => {
      loadQuota();
    }, 2000);

    return () => {
      isMounted = false;

      window.removeEventListener(
        "storage-quota-updated",
        handleQuotaUpdate
      );

      clearInterval(interval);
    };
  }, [user]);

  const usagePercentage = storageQuota
    ? Math.min(storageQuota.usagePercentage, 100)
    : 0;

  const storageLevel =
    usagePercentage >= 95
      ? "critical"
      : usagePercentage >= 80
      ? "warning"
      : usagePercentage >= 60
      ? "elevated"
      : "healthy";

  return (
    <aside className="sidebar">
      <Logo />

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-bottom">

        {/* STORAGE QUOTA */}
        {storageQuota && (
          <div className="sidebar-storage">
            <div className="sidebar-storage-header">
              <span>Storage</span>

              <strong>
                {formatStorage(storageQuota.storageUsed)} of{" "}
                {formatStorage(storageQuota.storageLimit)} used
              </strong>
            </div>

            <div className="sidebar-storage-track">
              <div
                className={`sidebar-storage-fill ${storageLevel}`}
                style={{
                  width: `${usagePercentage}%`,
                }}
              />
            </div>

            <button
              className="sidebar-upgrade-button"
              type="button"
            >
              Upgrade Plan
            </button>
          </div>
        )}

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;