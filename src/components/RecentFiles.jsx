import { useEffect, useRef, useState } from "react";
import {
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  MoreVertical,
  Download,
  Trash2,
} from "lucide-react";

import {
  downloadFile,
  deleteFile,
  getPreviewUrl,
} from "../services/files";

import FilePreviewModal from "./FilePreviewModal";

function getFileIcon(mimeType) {
  if (!mimeType) return <File size={20} />;

  if (mimeType.startsWith("image/")) {
    return <Image size={20} />;
  }

  if (mimeType.startsWith("video/")) {
    return <Video size={20} />;
  }

  if (mimeType.startsWith("audio/")) {
    return <Music size={20} />;
  }

  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  ) {
    return <FileText size={20} />;
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed")
  ) {
    return <Archive size={20} />;
  }

  return <File size={20} />;
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  return `${(
    bytes / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function RecentFiles({
  files = [],
  onFileDeleted,
  onViewAll,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [deletingFile, setDeletingFile] = useState(null);

  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const menuRef = useRef(null);
  const activeButtonRef = useRef(null);

  // Close menu when clicking anywhere outside it
  useEffect(() => {
    const handleOutsideClick = (event) => {
      const clickedInsideMenu =
        menuRef.current?.contains(event.target);

      const clickedButton =
        activeButtonRef.current?.contains(event.target);

      if (!clickedInsideMenu && !clickedButton) {
        setOpenMenu(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // Close menu when screen is resized or scrolled
  useEffect(() => {
    const closeMenu = () => {
      setOpenMenu(null);
      setMenuPosition(null);
    };

    window.addEventListener("resize", closeMenu);
    window.addEventListener(
      "scroll",
      closeMenu,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        closeMenu
      );

      window.removeEventListener(
        "scroll",
        closeMenu,
        true
      );
    };
  }, []);

  const handleMenuToggle = (fileId, event) => {
    if (openMenu === fileId) {
      setOpenMenu(null);
      setMenuPosition(null);
      return;
    }

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    const menuWidth = 150;
    const menuHeight = 94;
    const gap = 6;
    const screenPadding = 8;

    let left = rect.right - menuWidth;

    if (left < screenPadding) {
      left = screenPadding;
    }

    if (
      left + menuWidth >
      window.innerWidth - screenPadding
    ) {
      left =
        window.innerWidth -
        menuWidth -
        screenPadding;
    }

    const spaceBelow =
      window.innerHeight - rect.bottom;

    const spaceAbove = rect.top;

    let top;

    if (
      spaceBelow >= menuHeight + gap ||
      spaceBelow >= spaceAbove
    ) {
      top = rect.bottom + gap;
    } else {
      top = rect.top - menuHeight - gap;
    }

    activeButtonRef.current = button;

    setMenuPosition({
      top,
      left,
    });

    setOpenMenu(fileId);
  };

  const handlePreview = async (file) => {
    try {
      setOpenMenu(null);
      setMenuPosition(null);

      setPreviewFile(file);
      setPreviewUrl(null);
      setPreviewLoading(true);

      const url = await getPreviewUrl(
        file.storage_path
      );

      setPreviewUrl(url);
    } catch (error) {
      console.error(
        "Preview error:",
        error
      );

      setPreviewFile(null);
      setPreviewUrl(null);

      alert("Could not open this file.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      setOpenMenu(null);
      setMenuPosition(null);

      await downloadFile(
        file.storage_path
      );
    } catch (error) {
      console.error(
        "Download error:",
        error
      );
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${file.name}"?`
    );

    if (!confirmed) return;

    setDeletingFile(file.id);
    setOpenMenu(null);
    setMenuPosition(null);

    try {
      await deleteFile(file);

      onFileDeleted?.(file.id);
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      alert(
        "Could not delete the file."
      );
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <section className="recent-files">
      <div className="section-heading">
        <div>
          <p className="dashboard-eyebrow">
            Your library
          </p>

          <h2>Recent files</h2>
        </div>

        <button
          className="text-button"
          onClick={onViewAll}
        >
          View all
        </button>
      </div>

      {files.length === 0 ? (
        <div className="empty-files">
          <File size={28} />

          <strong>No files yet</strong>

          <p>
            Upload your first file to get started.
          </p>
        </div>
      ) : (
        <div className="file-list">
          {files.map((file) => (
            <div
              className="file-row"
              key={file.id}
              onDoubleClick={() =>
                handlePreview(file)
              }
            >
              <div className="file-icon">
                {getFileIcon(
                  file.mime_type
                )}
              </div>

              <div className="file-info">
                <strong>
                  {file.name}
                </strong>

                <span>
                  {formatFileSize(
                    file.size_bytes
                  )}
                </span>
              </div>

              <div className="file-actions">
                <button
                  className="file-more"
                  aria-label={`Actions for ${file.name}`}
                  onClick={(event) =>
                    handleMenuToggle(
                      file.id,
                      event
                    )
                  }
                  disabled={
                    deletingFile === file.id
                  }
                >
                  {deletingFile === file.id ? (
                    <span className="file-loading-dot" />
                  ) : (
                    <MoreVertical
                      size={18}
                    />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating file menu */}
      {openMenu && menuPosition && (
        <div
          ref={menuRef}
          className="file-menu file-menu-floating"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          {(() => {
            const file = files.find(
              (item) =>
                item.id === openMenu
            );

            if (!file) return null;

            return (
              <>
                <button
                  onClick={() =>
                    handlePreview(file)
                  }
                >
                  <File size={16} />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() =>
                    handleDownload(file)
                  }
                >
                  <Download size={16} />
                  <span>Download</span>
                </button>

                <button
                  className="danger-action"
                  onClick={() =>
                    handleDelete(file)
                  }
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* File preview */}
      {previewFile && (
        <>
          {previewLoading ? (
            <div className="preview-overlay">
              <div className="preview-loading">
                <div className="preview-loading-spinner" />

                <p>
                  Preparing preview...
                </p>
              </div>
            </div>
          ) : (
            <FilePreviewModal
              file={previewFile}
              signedUrl={previewUrl}
              onClose={() => {
                setPreviewFile(null);
                setPreviewUrl(null);
              }}
              onDownload={handleDownload}
            />
          )}
        </>
      )}
    </section>
  );
}

export default RecentFiles;