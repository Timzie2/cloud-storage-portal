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
  Share2,
  Folder,
  Pencil,
} from "lucide-react";

import {
  downloadFile,
  deleteFile,
  getPreviewUrl,
  moveFile,
} from "../services/files";

import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import { getUserFolders } from "../services/folders";
import ShareFileModal from "./ShareFileModal";
import FilePreviewModal from "./FilePreviewModal";
import FileDetailsModal from "./FileDetailsModal";

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
  onFileUpdated,
  onViewAll,
}) {
  const { user } = useAuth();

  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
 const [deletingFile, setDeletingFile] = useState(null);

const [shareFileData, setShareFileData] = useState(null);

const [renameFileData, setRenameFileData] = useState(null);
const [renameFileName, setRenameFileName] = useState("");
const [renameFileExtension, setRenameFileExtension] = useState("");
const [renamingFile, setRenamingFile] = useState(false);

const [moveFileData, setMoveFileData] = useState(null);
const [folders, setFolders] = useState([]);
const [loadingFolders, setLoadingFolders] = useState(false);
const [movingFile, setMovingFile] = useState(false);

const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [detailsFile, setDetailsFile] = useState(null);

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
    const menuHeight = 66;
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

  const handleShare = (file) => {
  setOpenMenu(null);
  setMenuPosition(null);
  activeButtonRef.current = null;

  setShareFileData(file);
};

const closeShare = () => {
  setShareFileData(null);
};

  const handleDownload = async (file) => {
    try {
      setOpenMenu(null);
      setMenuPosition(null);

      await downloadFile(file.storage_path, file.name);
    } catch (error) {
      console.error(
        "Download error:",
        error
      );
    }
  };

  const handleRenameOpen = (file) => {
  setOpenMenu(null);
  setMenuPosition(null);
  activeButtonRef.current = null;

  const lastDot = file.name.lastIndexOf(".");
  const hasExtension = lastDot > 0;

  setRenameFileData(file);
  setRenameFileName(
    hasExtension ? file.name.slice(0, lastDot) : file.name
  );
  setRenameFileExtension(
    hasExtension ? file.name.slice(lastDot) : ""
  );
};

const handleRename = async (event) => {
  event.preventDefault();

  if (
    !renameFileData ||
    !user?.id ||
    !renameFileName.trim()
  ) {
    return;
  }

  const newBaseName = renameFileName.trim();
  const newName = `${newBaseName}${renameFileExtension}`;

  if (newName === renameFileData.name) {
    setRenameFileData(null);
    setRenameFileName("");
    setRenameFileExtension("");
    return;
  }

  setRenamingFile(true);

  try {
    const { data, error } = await supabase
      .from("files")
      .update({ name: newName })
      .eq("id", renameFileData.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    setRenameFileData(null);
    setRenameFileName("");
    setRenameFileExtension("");

    // Update the file object used by Recent Files immediately.
    // Dashboard will refresh its files when needed.
    if (data) {
  onFileUpdated?.(data);
}
  } catch (error) {
    console.error("Rename file error:", error);
    alert("Could not rename the file. Please try again.");
  } finally {
    setRenamingFile(false);
  }
};

const handleMoveOpen = async (file) => {
  setOpenMenu(null);
  setMenuPosition(null);
  activeButtonRef.current = null;

  setMoveFileData(file);
  setFolders([]);
  setLoadingFolders(true);

  try {
    if (!user?.id) {
      throw new Error("User is not authenticated.");
    }

    const data = await getUserFolders(user.id);

    setFolders(data || []);
  } catch (error) {
    console.error("Load folders error:", error);
    alert("Could not load your folders.");
    setMoveFileData(null);
  } finally {
    setLoadingFolders(false);
  }
};

const handleMove = async (folderId) => {
  if (!moveFileData) return;

  setMovingFile(true);

  try {
    const updatedFile = await moveFile(
      moveFileData.id,
      folderId
    );

    if (updatedFile) {
      onFileUpdated?.(updatedFile);
    }

    setMoveFileData(null);
  } catch (error) {
    console.error("Move file error:", error);
    alert("Could not move the file. Please try again.");
  } finally {
    setMovingFile(false);
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
              onClick={() => handlePreview(file)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  handlePreview(file);
                }
              }}
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
                  onClick={(event) => {
                    event.stopPropagation();

                    handleMenuToggle(
                      file.id,
                      event
                    );
                  }}
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
  type="button"
  onClick={() => handleDownload(file)}
>
  <Download size={16} />
  Download
</button>

<button
  type="button"
  onClick={() => handleShare(file)}
>
  <Share2 size={16} />
  Share
</button>

<button
  type="button"
  onClick={() => handleRenameOpen(file)}
>
  <Pencil size={16} />
  Rename
</button>

<button
  type="button"
  onClick={() => handleMoveOpen(file)}
>
  <Folder size={16} />
  Move to folder
</button>

<button
  type="button"
  onClick={() => {
    setOpenMenu(null);
    setMenuPosition(null);
    activeButtonRef.current = null;
    setDetailsFile(file);
  }}
>
  <File size={16} />
  Details
</button>

<button
  type="button"
  className="danger-action"
  onClick={() => handleDelete(file)}
>
  <Trash2 size={16} />
  Delete
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

      {renameFileData && (
  <div
    className="rename-modal-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !renamingFile) {
        setRenameFileData(null);
        setRenameFileName("");
        setRenameFileExtension("");
      }
    }}
  >
    <div
      className="rename-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recent-rename-modal-title"
    >
      <div className="rename-modal-header">
        <div>
          <p className="rename-modal-eyebrow">
            RENAME FILE
          </p>

          <h2 id="recent-rename-modal-title">
            Rename file
          </h2>

          <p className="rename-modal-file-name">
            Choose a new name for your file.
          </p>
        </div>

        <button
          type="button"
          className="rename-modal-close"
          onClick={() => {
            if (renamingFile) return;

            setRenameFileData(null);
            setRenameFileName("");
            setRenameFileExtension("");
          }}
          aria-label="Close rename dialog"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleRename}>
        <div className="rename-modal-body">
          <label htmlFor="recent-rename-file-name">
            File name
          </label>

          <div className="rename-file-input-row">
            <input
              id="recent-rename-file-name"
              type="text"
              value={renameFileName}
              onChange={(event) =>
                setRenameFileName(event.target.value)
              }
              autoFocus
              disabled={renamingFile}
            />

            {renameFileExtension && (
              <span className="rename-file-extension">
                {renameFileExtension}
              </span>
            )}
          </div>
        </div>

        <div className="rename-modal-actions">
          <button
            type="button"
            className="rename-cancel-button"
            onClick={() => {
              if (renamingFile) return;

              setRenameFileData(null);
              setRenameFileName("");
              setRenameFileExtension("");
            }}
            disabled={renamingFile}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rename-save-button"
            disabled={
              renamingFile || !renameFileName.trim()
            }
          >
            {renamingFile ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{moveFileData && (
  <div
    className="folder-modal-overlay"
    onMouseDown={(event) => {
      if (
        event.target === event.currentTarget &&
        !movingFile
      ) {
        setMoveFileData(null);
      }
    }}
  >
    <div
      className="folder-modal move-folder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-folder-modal-title"
    >
      <div className="folder-modal-header">
        <div>
          <p className="folder-modal-eyebrow">
            MOVE FILE
          </p>

          <h2 id="move-folder-modal-title">
            Move to folder
          </h2>

          <p className="folder-modal-subtitle">
            Choose where you want to store this file.
          </p>
        </div>

        <button
          type="button"
          className="folder-modal-close"
          onClick={() => setMoveFileData(null)}
          disabled={movingFile}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="move-folder-list">
        {/* Root folder */}
        <button
          type="button"
          className="move-folder-option"
          onClick={() => handleMove(null)}
          disabled={
            movingFile ||
            moveFileData.folder_id === null
          }
        >
          <Folder size={20} />

          <div>
            <strong>My Files</strong>

            <span>
              {moveFileData.folder_id === null
                ? "Current folder"
                : "Root folder"}
            </span>
          </div>
        </button>

        {/* Folders */}
        {loadingFolders ? (
          <div className="move-folder-loading">
            Loading folders...
          </div>
        ) : folders.length === 0 ? (
          <p className="move-folder-empty">
            You don't have any folders yet.
          </p>
        ) : (
          folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="move-folder-option"
              onClick={() => handleMove(folder.id)}
              disabled={
                movingFile ||
                folder.id === moveFileData.folder_id
              }
            >
              <Folder size={20} />

              <div>
                <strong>{folder.name}</strong>

                <span>
                  {folder.id === moveFileData.folder_id
                    ? "Current folder"
                    : "Folder"}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {movingFile && (
        <p className="move-folder-loading">
          Moving file...
        </p>
      )}
    </div>
  </div>
)}

{shareFileData && (
  <ShareFileModal
    file={shareFileData}
    onClose={closeShare}
    onShared={() => {
      setShareFileData(null);
    }}
  />
)}


{detailsFile && (
  <FileDetailsModal
    file={detailsFile}
    onClose={() => setDetailsFile(null)}
  />
)}

    </section>
  );
}

export default RecentFiles;