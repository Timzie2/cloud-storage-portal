import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Grid2X2,
  List,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Share2,
  Folder,
  Plus,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getUserFiles,
  downloadFile,
  deleteFile,
  getPreviewUrl,
  shareFile,
  moveFile,
} from "../services/files";

import FilePreviewModal from "../components/FilePreviewModal";

import {
  getUserFolders,
  createFolder,
  deleteFolder,
} from "../services/folders";

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

function getFileType(mimeType) {
  if (!mimeType) return "Other";

  if (mimeType.startsWith("image/")) return "Images";
  if (mimeType.startsWith("video/")) return "Videos";
  if (mimeType.startsWith("audio/")) return "Audio";

  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  ) {
    return "Documents";
  }

  return "Other";
}

function formatFileSize(bytes) {
  if (!bytes) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

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

function Files() {
  const { user } = useAuth();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);

  

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("newest");

  const [viewMode, setViewMode] = useState("list");

  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [deletingFile, setDeletingFile] = useState(null);

  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [shareFileData, setShareFileData] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);

  const [moveFileData, setMoveFileData] = useState(null);
  const [movingFile, setMovingFile] = useState(false);

  const menuRef = useRef(null);
  const activeButtonRef = useRef(null);

  useEffect(() => {
  const loadFilesAndFolders = async () => {
    if (!user) return;

    try {
      const [fileData, folderData] = await Promise.all([
        getUserFiles(user.id),
        getUserFolders(user.id),
      ]);

      setFiles(fileData);
      setFolders(folderData);
    } catch (error) {
      console.error("Failed to load files and folders:", error);
    } finally {
      setLoading(false);
      setLoadingFolders(false);
    }
  };

  loadFilesAndFolders();
}, [user]);

  /*
   * Close the file menu when clicking outside it.
   */
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        activeButtonRef.current &&
        !activeButtonRef.current.contains(event.target)
      ) {
        setOpenMenu(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  /*
   * Keep the floating menu positioned correctly
   * when the page is resized or scrolled.
   */
  useEffect(() => {
    if (!openMenu) return;

    const updateMenuPosition = () => {
      if (!activeButtonRef.current) return;

      const rect = activeButtonRef.current.getBoundingClientRect();

      const menuWidth = 150;
      const menuHeight = 176;
      const gap = 6;
      const screenPadding = 8;

      let left = rect.right - menuWidth;

      if (left < screenPadding) {
        left = screenPadding;
      }

      if (left + menuWidth > window.innerWidth - screenPadding) {
        left = window.innerWidth - menuWidth - screenPadding;
      }

      const spaceBelow = window.innerHeight - rect.bottom;
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

      setMenuPosition({
        top,
        left,
      });
    };

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openMenu]);

  const filteredFiles = useMemo(() => {
    let result = [...files];

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter((file) =>
        file.name.toLowerCase().includes(query)
      );
    }

    if (filter !== "All") {
      result = result.filter(
        (file) => getFileType(file.mime_type) === filter
      );
    }

    result.sort((a, b) => {
      if (sort === "newest") {
        return (
          new Date(b.created_at) -
          new Date(a.created_at)
        );
      }

      if (sort === "oldest") {
        return (
          new Date(a.created_at) -
          new Date(b.created_at)
        );
      }

      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }

      if (sort === "size") {
        return (
          Number(b.size_bytes) -
          Number(a.size_bytes)
        );
      }

      return 0;
    });

    return result;
  }, [files, search, filter, sort]);

  const visibleFiles = useMemo(() => {
  return filteredFiles.filter(
    (file) => (file.folder_id ?? null) === currentFolderId
  );
}, [filteredFiles, currentFolderId]);

const folderPath = useMemo(() => {
  if (!currentFolderId) return [];

  const path = [];
  let folderId = currentFolderId;

  while (folderId) {
    const folder = folders.find(
      (item) => item.id === folderId
    );

    if (!folder) break;

    path.unshift(folder);
    folderId = folder.parent_id;
  }

  return path;
}, [folders, currentFolderId]);

  const handleMenuToggle = (file, event) => {
    if (openMenu === file.id) {
      setOpenMenu(null);
      setMenuPosition(null);
      activeButtonRef.current = null;
      return;
    }

    activeButtonRef.current = event.currentTarget;

    setOpenMenu(file.id);
    setMenuPosition(null);
  };

  const handlePreview = async (file) => {
    try {
      setOpenMenu(null);
      setMenuPosition(null);

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

  const handleShare = (file) => {
  setOpenMenu(null);
  setMenuPosition(null);

  setShareFileData(file);
  setShareEmail("");
};

const handleMoveOpen = (file) => {
  setOpenMenu(null);
  setMenuPosition(null);
  activeButtonRef.current = null;

  setMoveFileData(file);
};

const closeShare = () => {
  if (sharing) return;

  setShareFileData(null);
  setShareEmail("");
};

const handleShareSubmit = async (event) => {
  event.preventDefault();

  if (!shareFileData || !user?.id) return;

  const email = shareEmail.trim().toLowerCase();

  if (!email) {
    return;
  }

  if (email === user.email?.toLowerCase()) {
    alert("You can't share a file with yourself.");
    return;
  }

  setSharing(true);

  try {
    await shareFile(shareFileData, user.id, email);

    alert(`"${shareFileData.name}" was shared with ${email}.`);

    closeShare();
  } catch (error) {
    console.error("Share error:", error);
    alert("Could not share this file. Please try again.");
  } finally {
    setSharing(false);
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

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === updatedFile.id ? updatedFile : file
      )
    );

    setMoveFileData(null);
  } catch (error) {
    console.error("Move file error:", error);
    alert("Could not move the file. Please try again.");
  } finally {
    setMovingFile(false);
  }
};

const handleCreateFolder = async (event) => {
  event.preventDefault();

  if (!user?.id || !folderName.trim()) return;

  setCreatingFolder(true);

  try {
    const newFolder = await createFolder(user.id, folderName, currentFolderId);

    setFolders((currentFolders) => [
      newFolder,
      ...currentFolders,
    ]);

    setFolderName("");
    setShowFolderModal(false);
  } catch (error) {
    console.error("Create folder error:", error);
    alert("Could not create the folder. Please try again.");
  } finally {
    setCreatingFolder(false);
  }
};

const handleDeleteFolder = async (folder) => {
  const confirmed = window.confirm(
    `Are you sure you want to delete "${folder.name}"?`
  );

  if (!confirmed) return;

  try {
    await deleteFolder(folder.id);

    setFolders((currentFolders) =>
  currentFolders.filter((item) => {
    if (item.id === folder.id) {
      return false;
    }

    let parentId = item.parent_id;

    while (parentId) {
      if (parentId === folder.id) {
        return false;
      }

      const parentFolder = currentFolders.find(
        (currentFolder) => currentFolder.id === parentId
      );

      parentId = parentFolder?.parent_id ?? null;
    }

    return true;
  })
);

    if (currentFolderId === folder.id) {
      setCurrentFolderId(folder.parent_id ?? null);
    }
  } catch (error) {
    console.error("Delete folder error:", error);
    alert("Could not delete the folder. Please try again.");
  }
};

  const handleDownload = async (file) => {
    try {
      setOpenMenu(null);
      setMenuPosition(null);

      await downloadFile(file.storage_path);
    } catch (error) {
      console.error("Download error:", error);
      alert("Could not download this file.");
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

      setFiles((currentFiles) =>
        currentFiles.filter(
          (item) => item.id !== file.id
        )
      );
    } catch (error) {
      console.error("Delete error:", error);
      alert("Could not delete the file.");
    } finally {
      setDeletingFile(null);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  };

  return (
    <main className="dashboard files-page">
      <section className="dashboard-content">

        <div className="files-page-header">
  <div className="files-page-title">
    {currentFolderId && (
      <div className="files-breadcrumbs">
        <button
          type="button"
          onClick={() => setCurrentFolderId(null)}
        >
          My Files
        </button>

        {folderPath.map((folder) => (
          <span
            key={folder.id}
            className="files-breadcrumb-item"
          >
            <span>/</span>

            <button
              type="button"
              className={
                folder.id === currentFolderId
                  ? "current"
                  : ""
              }
              onClick={() => setCurrentFolderId(folder.id)}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>
    )}

    <p className="dashboard-eyebrow">
      Your files
    </p>

    <h1>
      {currentFolderId
        ? folders.find(
            (folder) => folder.id === currentFolderId
          )?.name || "Folder"
        : "My Files"}
    </h1>

    {!currentFolderId && (
      <p className="files-page-subtitle">
        Everything you've uploaded, all in one place.
      </p>
    )}
  </div>

  <div className="files-page-actions">
    <div className="files-count">
      <strong>{visibleFiles.length}</strong>
<span>
  {visibleFiles.length === 1 ? "file" : "files"}
</span>
    </div>

    <button
      type="button"
      className="new-folder-button"
      onClick={() => {
        setFolderName("");
        setShowFolderModal(true);
      }}
    >
      <Plus size={17} />
      <span>New Folder</span>
    </button>
  </div>
</div>

        <div className="files-toolbar">
          <div className="files-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="files-toolbar-controls">
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
            >
              <option value="All">All files</option>
              <option value="Images">Images</option>
              <option value="Videos">Videos</option>
              <option value="Documents">
                Documents
              </option>
              <option value="Audio">Audio</option>
              <option value="Other">Other</option>
            </select>

            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value)
              }
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Largest</option>
            </select>

            <div className="view-toggle">
              <button
                className={
                  viewMode === "list" ? "active" : ""
                }
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <List size={18} />
              </button>

              <button
                className={
                  viewMode === "grid" ? "active" : ""
                }
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Grid2X2 size={18} />
              </button>
            </div>
          </div>
        </div>

        {!loadingFolders && folders.filter(
  (folder) => folder.parent_id === currentFolderId
).length > 0 && (
  <div className="folders-section">
    <div className="folders-section-header">
      <h2>Folders</h2>
    </div>

    <div className="folders-grid">
      {folders
        .filter(
          (folder) => folder.parent_id === currentFolderId
        )
        .map((folder) => (
          <div
  key={folder.id}
  className="folder-card"
>
  <button
    type="button"
    className="folder-card-main"
    onClick={() => setCurrentFolderId(folder.id)}
  >
    <Folder size={22} />

    <span>{folder.name}</span>
  </button>

  <button
    type="button"
    className="folder-delete-button"
    title={`Delete ${folder.name}`}
    aria-label={`Delete ${folder.name}`}
    onClick={(event) => {
      event.stopPropagation();
      handleDeleteFolder(folder);
    }}
  >
    <Trash2 size={16} />
  </button>
</div>
        ))}
    </div>
  </div>
)}

        {loading ? (
          <div className="files-loading">
            Loading your files...
          </div>
        ) : visibleFiles.length === 0 ? (
          <div className="empty-files files-empty-page">
            <File size={32} />

            <strong>
              {search || filter !== "All"
                ? "No matching files"
                : "No files yet"}
            </strong>

            <p>
              {search || filter !== "All"
                ? "Try changing your search or filter."
                : "Upload your first file to get started."}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="all-files-list">
  {visibleFiles.map((file) => (
              <div
                className="all-file-row"
                key={file.id}
              >
                <div className="file-icon">
                  {getFileIcon(file.mime_type)}
                </div>

                <div className="all-file-name">
                  <strong>{file.name}</strong>

                  <span>
                    {getFileType(file.mime_type)}
                  </span>
                </div>

                <span className="all-file-size">
                  {formatFileSize(file.size_bytes)}
                </span>

                <span className="all-file-date">
                  {formatDate(file.created_at)}
                </span>

                <div className="all-file-actions">
                  <button
                    className="file-more"
                    onClick={(event) =>
                      handleMenuToggle(file, event)
                    }
                    disabled={
                      deletingFile === file.id
                    }
                    aria-label={`Actions for ${file.name}`}
                  >
                    {deletingFile === file.id ? (
                      <span className="file-loading-dot" />
                    ) : (
                      <MoreVertical size={18} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="files-grid">
  {visibleFiles.map((file) => (
              <div
                className="file-grid-card"
                key={file.id}
              >
                <div className="file-grid-icon">
                  {getFileIcon(file.mime_type)}
                </div>

                <strong>{file.name}</strong>

                <span>
                  {formatFileSize(file.size_bytes)}
                </span>

                <span>
                  {formatDate(file.created_at)}
                </span>

                <div className="file-grid-actions">
                  <button
                    onClick={() => handlePreview(file)}
                  >
                    <Eye size={16} />
                    Preview
                  </button>

                  <button
                    onClick={() =>
                      handleDownload(file)
                    }
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
  onClick={() => handleMoveOpen(file)}
>
  <Folder size={16} />
  Move to folder
</button>

                  <button
                    className="danger-action"
                    onClick={() =>
                      handleDelete(file)
                    }
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
                (item) => item.id === openMenu
              );

              if (!file) return null;

              return (
                <>
                  <button
                    onClick={() =>
                      handlePreview(file)
                    }
                  >
                    <Eye size={16} />
                    Preview
                  </button>

                  <button
                    onClick={() =>
                      handleDownload(file)
                    }
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
  onClick={() => handleMoveOpen(file)}
>
  <Folder size={16} />
  Move to folder
</button>

                  <button
                    className="danger-action"
                    onClick={() =>
                      handleDelete(file)
                    }
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </>
              );
            })()}
          </div>
        )}
      </section>

      {shareFileData && (
  <div
    className="share-modal-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        closeShare();
      }
    }}
  >
    <div
      className="share-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="share-modal-header">
        <div>
          <p className="share-modal-eyebrow">SHARE FILE</p>

          <h2 id="share-modal-title">
            Share file
          </h2>

          <p className="share-modal-file-name">
            {shareFileData.name}
          </p>
        </div>

        <button
          type="button"
          className="share-modal-close"
          onClick={closeShare}
          disabled={sharing}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleShareSubmit}>
        <label htmlFor="share-email">
          Email address
        </label>

        <input
          id="share-email"
          type="email"
          placeholder="name@example.com"
          value={shareEmail}
          onChange={(event) => setShareEmail(event.target.value)}
          autoFocus
          required
        />

        <p className="share-modal-hint">
          Enter the email address of the person you want to share this
          file with.
        </p>

        <div className="share-modal-actions">
          <button
            type="button"
            className="share-cancel-button"
            onClick={closeShare}
            disabled={sharing}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="share-submit-button"
            disabled={sharing || !shareEmail.trim()}
          >
            {sharing ? "Sharing..." : "Share file"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{showFolderModal && (
  <div
    className="folder-modal-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        if (!creatingFolder) {
          setShowFolderModal(false);
        }
      }
    }}
  >
    <div
      className="folder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-modal-title"
    >
      <div className="folder-modal-header">
        <div>
          <p className="folder-modal-eyebrow">
            NEW FOLDER
          </p>

          <h2 id="folder-modal-title">
            Create folder
          </h2>

          <p className="folder-modal-subtitle">
            Organize your files into a new folder.
          </p>
        </div>

        <button
          type="button"
          className="folder-modal-close"
          onClick={() => setShowFolderModal(false)}
          disabled={creatingFolder}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleCreateFolder}>
        <label htmlFor="folder-name">
          Folder name
        </label>

        <input
          id="folder-name"
          type="text"
          placeholder="e.g. Projects"
          value={folderName}
          onChange={(event) =>
            setFolderName(event.target.value)
          }
          autoFocus
          maxLength={80}
          required
        />

        <div className="folder-modal-actions">
          <button
            type="button"
            className="folder-cancel-button"
            onClick={() => setShowFolderModal(false)}
            disabled={creatingFolder}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="folder-create-button"
            disabled={
              creatingFolder || !folderName.trim()
            }
          >
            {creatingFolder
              ? "Creating..."
              : "Create folder"}
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
      if (event.target === event.currentTarget && !movingFile) {
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
        <button
          type="button"
          className="move-folder-option"
          onClick={() => handleMove(null)}
          disabled={movingFile}
        >
          <Folder size={18} />

          <div>
            <strong>My Files</strong>
            <span>Root folder</span>
          </div>
        </button>

        {folders.length === 0 ? (
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
              <Folder size={18} />

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

export default Files;