import { useEffect, useState } from "react";
import {
  File,
  Image,
  Film,
  Music,
  FileText,
  UserRound,
  X,
  Eye,
  Download,
  Share2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import {
  getFileShares,
  getSharedWithMe,
  revokeShare,
  getPreviewUrl,
  downloadFile,
} from "../services/files";

import FilePreviewModal from "../components/FilePreviewModal";
import NovaLoader from "../components/NovaLoader";

function formatFileSize(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getFileIcon(mimeType) {
  if (!mimeType) return File;

  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.startsWith("audio/")) return Music;

  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  ) {
    return FileText;
  }

  return File;
}

function Shared() {
  const { user } = useAuth();

  const [sharedByMe, setSharedByMe] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [revokeTarget, setRevokeTarget] = useState(null);

  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    loadShares();
  }, [user]);

  async function loadShares() {
    try {
      setLoading(true);
      setError("");

      const [ownedShares, receivedShares] = await Promise.all([
        getFileShares(user.id),
        getSharedWithMe(user.email),
      ]);

      setSharedByMe(ownedShares);
      setSharedWithMe(receivedShares);
    } catch (err) {
      console.error("Error loading shared files:", err);
      setError("Could not load shared files.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(file) {
    try {
      setPreviewFile(file);
      setPreviewUrl(null);
      setPreviewLoading(true);

      const url = await getPreviewUrl(file.storage_path);

      setPreviewUrl(url);
    } catch (err) {
      console.error("Preview error:", err);
      setError("Could not preview this file.");
      setPreviewFile(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDownload(file) {
    try {
      await downloadFile(file.storage_path);
    } catch (err) {
      console.error("Download error:", err);
      setError("Could not download this file.");
    }
  }

  function closePreview() {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  }

  async function handleRevoke() {
    if (!revokeTarget) return;

    try {
      await revokeShare(revokeTarget.id);

      setSharedByMe((current) =>
        current.filter((share) => share.id !== revokeTarget.id)
      );

      setRevokeTarget(null);
    } catch (err) {
      console.error("Error revoking share:", err);
      setError("Could not revoke the share.");
    }
  }

  if (loading) {
  return <NovaLoader message="Loading shared files..." />;
}

  return (
    <main className="dashboard shared-page">
      <section className="dashboard-content">

        {/* PAGE HEADER */}
        <div className="shared-page-header">
          <p className="dashboard-eyebrow">COLLABORATION</p>

          <h1>Shared</h1>

          <p>
            Files shared by you and with you.
          </p>
        </div>

        {error && (
          <div className="shared-error">
            {error}
          </div>
        )}

        {/* =========================================
            SHARED BY YOU
        ========================================= */}

        <section className="shared-section">

          <div className="shared-section-header">
            <div className="shared-section-title">
              <div className="shared-section-icon">
                <Share2 size={18} />
              </div>

              <div>
                <h2>Shared by you</h2>
                <p>
                  Files you've shared with other people.
                </p>
              </div>
            </div>

            <span className="shared-count">
              {sharedByMe.length}
              <span>
                {sharedByMe.length === 1 ? " file" : " files"}
              </span>
            </span>
          </div>

          {sharedByMe.length === 0 ? (
            <div className="shared-empty">
              <div className="shared-empty-icon">
                <Share2 size={22} />
              </div>

              <h3>Nothing shared yet</h3>

              <p>
                Files you share with other people will appear here.
              </p>
            </div>
          ) : (
            <div className="shared-list">

              {sharedByMe.map((share) => {
                const file = share.files;
                const Icon = getFileIcon(file?.mime_type);

                return (
                  <div
                    className="shared-item"
                    key={share.id}
                  >
                    <div className="shared-file-icon">
                      <Icon size={20} />
                    </div>

                    <div className="shared-file-info">
                      <h3>
                        {file?.name || "Unknown file"}
                      </h3>

                      <p>
                        {formatFileSize(file?.size_bytes)}
                        <span>·</span>
                        Shared {formatDate(share.created_at)}
                      </p>
                    </div>

                    <div className="shared-role">
                      <UserRound size={15} />

                      <div>
                        <span className="shared-role-label">
                          Shared with
                        </span>

                        <strong>
                          {share.shared_with_email}
                        </strong>
                      </div>
                    </div>

                    <div className="shared-item-actions">
                      <button
                        className="shared-action-btn"
                        onClick={() => handlePreview(file)}
                        title="Preview"
                      >
                        <Eye size={17} />
                      </button>

                      <button
                        className="shared-action-btn"
                        onClick={() => handleDownload(file)}
                        title="Download"
                      >
                        <Download size={17} />
                      </button>

                      <button
                        className="shared-revoke-btn"
                        onClick={() => setRevokeTarget(share)}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </section>

        {/* =========================================
            SHARED WITH YOU
        ========================================= */}

        <section className="shared-section">

          <div className="shared-section-header">
            <div className="shared-section-title">
              <div className="shared-section-icon">
                <UserRound size={18} />
              </div>

              <div>
                <h2>Shared with you</h2>
                <p>
                  Files other people have shared with you.
                </p>
              </div>
            </div>

            <span className="shared-count">
              {sharedWithMe.length}
              <span>
                {sharedWithMe.length === 1 ? " file" : " files"}
              </span>
            </span>
          </div>

          {sharedWithMe.length === 0 ? (
            <div className="shared-empty">
              <div className="shared-empty-icon">
                <UserRound size={22} />
              </div>

              <h3>No shared files</h3>

              <p>
                Files shared with your account will appear here.
              </p>
            </div>
          ) : (
            <div className="shared-list">

              {sharedWithMe.map((share) => {
                const file = share.files;
                const Icon = getFileIcon(file?.mime_type);

                return (
                  <div
                    className="shared-item"
                    key={share.id}
                  >
                    <div className="shared-file-icon">
                      <Icon size={20} />
                    </div>

                    <div className="shared-file-info">
                      <h3>
                        {file?.name || "Unknown file"}
                      </h3>

                      <p>
                        {formatFileSize(file?.size_bytes)}
                        <span>·</span>
                        Shared {formatDate(share.created_at)}
                      </p>
                    </div>

                    <div className="shared-role">
                      <UserRound size={15} />

                      <div>
                        <span className="shared-role-label">
                          Access
                        </span>

                        <strong>
                          Shared with you
                        </strong>
                      </div>
                    </div>

                    <div className="shared-item-actions">
                      <button
                        className="shared-action-btn"
                        onClick={() => handlePreview(file)}
                        title="Preview"
                      >
                        <Eye size={17} />
                      </button>

                      <button
                        className="shared-action-btn"
                        onClick={() => handleDownload(file)}
                        title="Download"
                      >
                        <Download size={17} />
                      </button>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </section>

      </section>

      {/* REVOKE MODAL */}

      {revokeTarget && (
        <div
          className="shared-modal-overlay"
          onClick={() => setRevokeTarget(null)}
        >
          <div
            className="shared-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="shared-modal-close"
              onClick={() => setRevokeTarget(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="shared-modal-icon">
              <Share2 size={20} />
            </div>

            <h2>Revoke access?</h2>

            <p>
              <strong>
                {revokeTarget.files?.name}
              </strong>{" "}
              will no longer be accessible to{" "}
              <strong>
                {revokeTarget.shared_with_email}
              </strong>.
            </p>

            <div className="shared-modal-actions">
              <button
                className="shared-cancel-btn"
                onClick={() => setRevokeTarget(null)}
              >
                Cancel
              </button>

              <button
                className="shared-confirm-btn"
                onClick={handleRevoke}
              >
                Revoke access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW */}

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          signedUrl={previewUrl}
          onClose={closePreview}
          onDownload={() =>
            handleDownload(previewFile)
          }
          loading={previewLoading}
        />
      )}
    </main>
  );
}

export default Shared;