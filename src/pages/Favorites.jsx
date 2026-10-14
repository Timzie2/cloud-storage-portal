
import { useCallback, useEffect, useState } from "react";
import { Star, File, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NovaLoader from "../components/NovaLoader";
import FilePreviewModal from "../components/FilePreviewModal";
import {
  getFavoriteFiles,
  toggleFavorite,
  getPreviewUrl,
  downloadFile,
} from "../services/files";

function formatFileSize(bytes = 0) {
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function Favorites() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (!user?.id) {
      setFiles([]);
      setLoading(false);
      return;
    }

    try {
      const data = await getFavoriteFiles(user.id);
      setFiles(data);
    } catch (error) {
      console.error("Could not load favorites:", error);
      alert("Could not load your favorites. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleRemoveFavorite = async (file) => {
    try {
      await toggleFavorite(file.id, false);
      setFiles((currentFiles) =>
        currentFiles.filter((item) => item.id !== file.id)
      );
    } catch (error) {
      console.error("Could not remove favorite:", error);
      alert("Could not remove this favorite. Please try again.");
    }
  };

  const handlePreview = async (file) => {
  try {
    setPreviewFile(file);
    setPreviewUrl(null);
    setPreviewLoading(true);

    const url = await getPreviewUrl(file.storage_path);
    setPreviewUrl(url);
  } catch (error) {
    console.error("Preview error:", error);
    setPreviewFile(null);
    setPreviewUrl(null);
    alert("Could not open this file.");
  } finally {
    setPreviewLoading(false);
  }
};

const closePreview = () => {
  setPreviewFile(null);
  setPreviewUrl(null);
  setPreviewLoading(false);
};

const handleDownload = async (file) => {
  try {
    await downloadFile(file.storage_path, file.name);
  } catch (error) {
    console.error("Download error:", error);
    alert("Could not download this file.");
  }
};

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  if (loading) {
    return <NovaLoader message="Loading your favorites..." />;
  }

  return (
    <main className="dashboard favorites-page">
      <section className="dashboard-content">
        <div className="files-page-header">
          <div className="files-page-title">
            <p className="dashboard-eyebrow">Your collection</p>
            <h1>Favorites</h1>
            <p className="files-page-subtitle">
              Keep your most important files close at hand.
            </p>
          </div>

          <div className="files-page-actions">
            <div className="files-count">
              <strong>{filteredFiles.length}</strong>
              <span>
                {filteredFiles.length === 1 ? "file" : "files"}
              </span>
            </div>
          </div>
        </div>

        <div className="files-toolbar">
          <div className="files-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search favorites..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="empty-files files-empty-page">
            <Star size={32} />
            <strong>
              {search ? "No matching favorites" : "No favorites yet"}
            </strong>
            <p>
              {search
                ? "Try another search term."
                : "Star files from My Files or Recent Files to find them here."}
            </p>
          </div>
        ) : (
          <div className="all-files-list">
            {filteredFiles.map((file) => (
              <div
  className="all-file-row"
  key={file.id}
  onClick={() => handlePreview(file)}
  style={{ cursor: "pointer" }}
>
                <div className="file-icon">
                  <File size={20} />
                </div>

                <div className="all-file-name">
                  <strong>{file.name}</strong>
                  <span>{file.mime_type || "File"}</span>
                </div>

                <span className="all-file-size">
                  {formatFileSize(Number(file.size_bytes))}
                </span>

                <button
  type="button"
  className="favorite-remove-button"
  onClick={(event) => {
    event.stopPropagation();
    handleRemoveFavorite(file);
  }}
  title="Remove from Favorites"
  aria-label={`Remove ${file.name} from Favorites`}
>
  <Star size={18} fill="currentColor" />
</button>
              </div>
            ))}
          </div>
        )}
      </section>
      {previewFile && (
  <>
    {previewLoading ? (
      <div className="preview-overlay">
        <div className="preview-loading">
          <div className="preview-loading-spinner" />
          <p>Preparing preview...</p>
        </div>
      </div>
    ) : (
      <FilePreviewModal
        file={previewFile}
        signedUrl={previewUrl}
        onClose={closePreview}
        onDownload={handleDownload}
      />
    )}
  </>
)}
    </main>
  );
}

export default Favorites;
