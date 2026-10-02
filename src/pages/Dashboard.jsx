import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  FolderOpen,
  Share2,
  UploadCloud,
  ArrowRight,
  Search,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getUserFiles,
  getSharedFileCount,
} from "../services/files";
import { getStorageQuota } from "../services/storageQuota";
import { getProfile } from "../services/profile";

import ThemeToggle from "../components/ThemeToggle";
import NotificationBell from "../components/NotificationBell";
import Logo from "../components/Logo";
import StorageOverview from "../components/StorageOverview";
import UploadCard from "../components/UploadCard";
import RecentFiles from "../components/RecentFiles";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
}

function Dashboard() {
  const { user, logout } = useAuth();

    const refreshStorageQuota = async () => {
  if (!user) return;

  try {
    const quota = await getStorageQuota(user.id);

    setStorageQuota(quota);

    window.dispatchEvent(
      new CustomEvent("storage-quota-updated", {
        detail: quota,
      })
    );
  } catch (error) {
    console.error("Failed to refresh storage quota:", error);
  }
};

  const [files, setFiles] = useState([]);
  const [sharedCount, setSharedCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [storageQuota, setStorageQuota] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const loadFiles = async () => {
      if (!user) return;

      try {
  const [data, sharedCount, quota, profileData] =
  await Promise.all([
    getUserFiles(user.id),
    getSharedFileCount(user.id),
    getStorageQuota(user.id),
    getProfile(user.id),
  ]);

  setFiles(data);
  setSharedCount(sharedCount);
  setStorageQuota(quota);
  setProfile(profileData);
} catch (error) {
        console.error("Failed to load files:", error);
      } finally {
        setLoadingFiles(false);
      }
    };

    loadFiles();
  }, [user]);

  useEffect(() => {
  if (!user) return;

  const handleProfileUpdate = (event) => {
    if (event.detail) {
      setProfile(event.detail);
    }
  };

  window.addEventListener(
    "profile-updated",
    handleProfileUpdate
  );

  return () => {
    window.removeEventListener(
      "profile-updated",
      handleProfileUpdate
    );
  };
}, [user]);

  const filteredFiles = files.filter((file) =>
  file.name
    ?.toLowerCase()
    .includes(searchQuery.trim().toLowerCase())
);

  return (
    <main className="dashboard dashboard-home">

      {/* =========================================
          HEADER
      ========================================= */}

      <header className="dashboard-header">
  <div className="mobile-logo">
    <Logo />
  </div>

  <div className="dashboard-search">
    <Search size={17} />

    <input
      type="search"
      placeholder="Search files..."
      value={searchQuery}
      onChange={(event) => setSearchQuery(event.target.value)}
      aria-label="Search files"
    />

    {searchQuery && (
      <button
        className="dashboard-search-clear"
        onClick={() => setSearchQuery("")}
        aria-label="Clear search"
      >
        ×
      </button>
    )}
  </div>

  <div className="dashboard-header-actions">
  <NotificationBell />

  <ThemeToggle />

  <button
    className="theme-toggle"
    onClick={logout}
    aria-label="Logout"
    title="Logout"
  >
    <LogOut size={18} />
  </button>
</div>
</header>


      {/* =========================================
          DASHBOARD CONTENT
      ========================================= */}

      <section className="dashboard-content">

        {/* HERO */}

        <div className="dashboard-hero">

          <div>
            <p className="dashboard-eyebrow">
              Your digital space
            </p>

            <h1 className="dashboard-title">
              {getGreeting()} 👋
            </h1>

            <p className="dashboard-subtitle">
              Welcome back. Everything you need is right here.
            </p>
          </div>

          <div className="dashboard-user">
  <div className="dashboard-user-avatar">
    {(
      profile?.display_name ||
      user?.email ||
      "U"
    )
      .charAt(0)
      .toUpperCase()}
  </div>

  <div>
  <span>
    {profile?.display_name || "Signed in as"}
  </span>

  <strong>{user?.email}</strong>
</div>
</div>

        </div>


        {/* STORAGE + UPLOAD */}

        <div className="dashboard-main-grid">

          <div className="dashboard-storage-panel">
            <StorageOverview
  files={files}
  sharedCount={sharedCount}
  storageQuota={storageQuota}
/>
          </div>

          <div className="dashboard-upload-panel">
            <UploadCard
              onUploadComplete={async (uploadedFile) => {
                setFiles((currentFiles) => [
                  uploadedFile,
                  ...currentFiles,
                ]);

                await refreshStorageQuota();
              }}
            />
          </div>

        </div>


        {/* QUICK ACTIONS */}

        <div className="dashboard-section-header">
          <div>
            <h2>Quick access</h2>
            <p>
              Jump straight to where you need to go.
            </p>
          </div>
        </div>

        <div className="dashboard-quick-actions">

          <button
            className="dashboard-action-card"
            onClick={() => navigate("/files")}
          >
            <div className="dashboard-action-icon">
              <FolderOpen size={20} />
            </div>

            <div className="dashboard-action-content">
              <strong>My Files</strong>
              <span>
                Browse all your files
              </span>
            </div>

            <ArrowRight size={17} />
          </button>


          <button
            className="dashboard-action-card"
            onClick={() => navigate("/shared")}
          >
            <div className="dashboard-action-icon">
              <Share2 size={20} />
            </div>

            <div className="dashboard-action-content">
              <strong>Shared</strong>
              <span>
                Files shared with you
              </span>
            </div>

            <ArrowRight size={17} />
          </button>


          <button
            className="dashboard-action-card"
            onClick={() =>
              document
                .querySelector(".upload-card input[type='file']")
                ?.click()
            }
          >
            <div className="dashboard-action-icon">
              <UploadCloud size={20} />
            </div>

            <div className="dashboard-action-content">
              <strong>Upload</strong>
              <span>
                Add a new file
              </span>
            </div>

            <ArrowRight size={17} />
          </button>

        </div>


        {/* RECENT FILES */}

        <div className="dashboard-section-header dashboard-recent-header">
          <div>
            <h2>Recent files</h2>
            <p>
              Your latest uploads.
            </p>
          </div>
        </div>

        {loadingFiles ? (
          <div className="files-loading">
            Loading your files...
          </div>
        ) : (
          <RecentFiles
            files={filteredFiles.slice(0, 5)}
            onFileDeleted={async (deletedFileId) => {
              setFiles((currentFiles) =>
                currentFiles.filter(
                  (file) => file.id !== deletedFileId
                )
              );

              await refreshStorageQuota();
            }}
            onViewAll={() => navigate("/files")}
          />
        )}

      </section>
    </main>
  );
}

export default Dashboard;