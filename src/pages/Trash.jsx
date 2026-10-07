import { useEffect, useState } from "react";import {
  RotateCcw,
  Trash2,
  File,
  Image,
  Film,
  Music,
  FileText,
  Folder,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getTrashedFiles,
  restoreFile,
  permanentlyDeleteFile,
} from "../services/files";

import {
  getTrashedFolders,
  restoreFolder,
  permanentlyDeleteFolder,
} from "../services/folders";

import NovaLoader from "../components/NovaLoader";

function Trash() {
  const { user } = useAuth();

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTrash = async () => {
      if (!user?.id) return;

      setLoading(true);
      setError("");

      try {
        const [fileData, folderData] = await Promise.all([
  getTrashedFiles(user.id),
  getTrashedFolders(user.id),
]);

setFiles(fileData);
setFolders(folderData);
      } catch (err) {
        console.error("Trash loading error:", err);
        setError("Unable to load your trash.");
      } finally {
        setLoading(false);
      }
    };

    loadTrash();
  }, [user]);

  const handleRestore = async (file) => {
    setActionId(file.id);
    setError("");

    try {
      await restoreFile(file);

      setFiles((currentFiles) =>
        currentFiles.filter((item) => item.id !== file.id)
      );
    } catch (err) {
      console.error("Restore error:", err);
      setError("Unable to restore this file.");
    } finally {
      setActionId(null);
    }
  };

  const handleRestoreFolder = async (folder) => {
  setActionId(folder.id);
  setError("");

  try {
    await restoreFolder(folder.id);

    setFolders((currentFolders) =>
      currentFolders.filter((item) => item.id !== folder.id)
    );
  } catch (err) {
    console.error("Restore folder error:", err);
    setError("Unable to restore this folder.");
  } finally {
    setActionId(null);
  }
};

  const handlePermanentDelete = async (file) => {
    const confirmed = window.confirm(
      `Permanently delete "${file.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setActionId(file.id);
    setError("");

    try {
      await permanentlyDeleteFile(file);

      setFiles((currentFiles) =>
        currentFiles.filter((item) => item.id !== file.id)
      );
    } catch (err) {
      console.error("Permanent delete error:", err);
      setError("Unable to permanently delete this file.");
    } finally {
      setActionId(null);
    }
  };

  const handlePermanentDeleteFolder = async (folder) => {
  const confirmed = window.confirm(
    `Permanently delete "${folder.name}"? This action cannot be undone.`
  );

  if (!confirmed) return;

  setActionId(folder.id);
  setError("");

  try {
    await permanentlyDeleteFolder(folder.id);

    setFolders((currentFolders) =>
      currentFolders.filter((item) => item.id !== folder.id)
    );
  } catch (err) {
    console.error("Permanent folder delete error:", err);
    setError("Unable to permanently delete this folder.");
  } finally {
    setActionId(null);
  }
};

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith("image/")) return Image;
    if (mimeType?.startsWith("video/")) return Film;
    if (mimeType?.startsWith("audio/")) return Music;
    if (mimeType?.includes("pdf") || mimeType?.includes("text")) {
      return FileText;
    }

    return File;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, index)).toFixed(
      index === 0 ? 0 : 1
    )} ${units[index]}`;
  };

  const formatDeletedDate = (date) => {
    if (!date) return "Unknown date";

    return new Date(date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <main className="dashboard trash-page">
      <div className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">RECYCLE BIN</p>

          <h1 className="dashboard-title">
            Trash
          </h1>

          <p className="dashboard-subtitle">
            Files you delete will stay here until you permanently remove them.
          </p>
        </div>
      </div>

      {error && (
        <div className="trash-error">
          {error}
        </div>
      )}

      {loading ? (
  <NovaLoader message="Loading trash..." />
) : files.length === 0 && folders.length === 0 ? (
        <div className="page-placeholder trash-empty">
          <Trash2 size={34} />

          <h3>Your trash is empty</h3>

          <p>
            Deleted files will appear here.
          </p>
        </div>
      ) : (
        <section className="trash-list">
  {folders.map((folder) => {
    const isProcessing = actionId === folder.id;

    return (
      <article className="trash-item" key={`folder-${folder.id}`}>
        <div className="trash-file-icon">
          <Folder size={20} />
        </div>

        <div className="trash-file-info">
          <h3 title={folder.name}>
            {folder.name}
          </h3>

          <p>
            Folder
            {" · "}
            Deleted {formatDeletedDate(folder.deleted_at)}
          </p>
        </div>

        <div className="trash-actions">
          <button
            type="button"
            className="trash-restore-button"
            onClick={() => handleRestoreFolder(folder)}
            disabled={isProcessing}
          >
            <RotateCcw size={16} />
            <span>Restore</span>
          </button>

          <button
            type="button"
            className="trash-delete-button"
            onClick={() => handlePermanentDeleteFolder(folder)}
            disabled={isProcessing}
          >
            <Trash2 size={16} />
            <span>
              {isProcessing ? "Deleting..." : "Delete permanently"}
            </span>
          </button>
        </div>
      </article>
    );
  })}

  {files.map((file) => {
            const Icon = getFileIcon(file.mime_type);
            const isProcessing = actionId === file.id;

            return (
              <article className="trash-item" key={file.id}>
                <div className="trash-file-icon">
                  <Icon size={20} />
                </div>

                <div className="trash-file-info">
                  <h3 title={file.name}>
                    {file.name}
                  </h3>

                  <p>
                    {formatFileSize(file.size_bytes)}
                    {" · "}
                    Deleted {formatDeletedDate(file.deleted_at)}
                  </p>
                </div>

                <div className="trash-actions">
                  <button
                    type="button"
                    className="trash-restore-button"
                    onClick={() => handleRestore(file)}
                    disabled={isProcessing}
                  >
                    <RotateCcw size={16} />
                    <span>Restore</span>
                  </button>

                  <button
                    type="button"
                    className="trash-delete-button"
                    onClick={() => handlePermanentDelete(file)}
                    disabled={isProcessing}
                  >
                    <Trash2 size={16} />
                    <span>
                      {isProcessing ? "Deleting..." : "Delete permanently"}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

export default Trash;