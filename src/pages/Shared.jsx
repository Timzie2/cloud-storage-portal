import { useEffect, useState } from "react";
import JSZip from "jszip";
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
  Folder,
  ChevronLeft,
  Copy,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import {
  getFileShares,
  getSharedWithMe,
  revokeShare,
  getPreviewUrl,
  downloadFile,
  getFilesInFolder,
  copySharedFile,
} from "../services/files";


import FilePreviewModal from "../components/FilePreviewModal";
import NovaLoader from "../components/NovaLoader";

import {
  getFolderShares,
  revokeFolderShare,
  getFolderSharesByOwner,
  getSharedFoldersWithMe,
  getSubfolders,
  copySharedFolder,
  getUserFolders,
  downloadSharedFolderAsZip,
} from "../services/folders";


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


function getDestinationFolderPath(folder, folders) {
  const parts = [folder.name];
  let parentId = folder.parent_id;
  let safety = 0;

  while (parentId && safety < folders.length) {
    const parent = folders.find((item) => item.id === parentId);

    if (!parent) break;

    parts.unshift(parent.name);
    parentId = parent.parent_id;
    safety += 1;
  }

  return parts.join(" / ");
}


function Shared() {
  const { user } = useAuth();

  const [sharedByMe, setSharedByMe] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [foldersSharedByMe, setFoldersSharedByMe] = useState([]);
  const [foldersSharedWithMe, setFoldersSharedWithMe] = useState([]);
  const [folderRevokeTarget, setFolderRevokeTarget] = useState(null);
  const [currentSharedFolder, setCurrentSharedFolder] = useState(null);
  const [sharedFolderFolders, setSharedFolderFolders] = useState([]);
  const [sharedFolderFiles, setSharedFolderFiles] = useState([]);
  const [sharedFolderLoading, setSharedFolderLoading] = useState(false);
  const [sharedFolderHistory, setSharedFolderHistory] = useState([]);
  const [copyingItem, setCopyingItem] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyTarget, setCopyTarget] = useState(null);
  const [destinationFolders, setDestinationFolders] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState("");
  const [loadingDestinations, setLoadingDestinations] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [fileErrorExiting, setFileErrorExiting] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [folderErrorExiting, setFolderErrorExiting] = useState(false);
  const [openedFolderError, setOpenedFolderError] = useState("");
  const [openedFolderErrorExiting, setOpenedFolderErrorExiting] =
  useState(false);



useEffect(() => {
  if (!fileError) {
    setFileErrorExiting(false);
    return;
  }

  setFileErrorExiting(false);

  const exitTimer = setTimeout(() => {
    setFileErrorExiting(true);
  }, 3700);

  const removeTimer = setTimeout(() => {
    setFileError("");
    setFileErrorExiting(false);
  }, 4100);

  return () => {
    clearTimeout(exitTimer);
    clearTimeout(removeTimer);
  };
}, [fileError]);


useEffect(() => {
  if (!folderError) {
    setFolderErrorExiting(false);
    return;
  }

  setFolderErrorExiting(false);

  const exitTimer = setTimeout(() => {
    setFolderErrorExiting(true);
  }, 3700);

  const removeTimer = setTimeout(() => {
    setFolderError("");
    setFolderErrorExiting(false);
  }, 4100);

  return () => {
    clearTimeout(exitTimer);
    clearTimeout(removeTimer);
  };
}, [folderError]);

useEffect(() => {
  if (!openedFolderError) {
    setOpenedFolderErrorExiting(false);
    return;
  }

  setOpenedFolderErrorExiting(false);

  const exitTimer = setTimeout(() => {
    setOpenedFolderErrorExiting(true);
  }, 3700);

  const removeTimer = setTimeout(() => {
    setOpenedFolderError("");
    setOpenedFolderErrorExiting(false);
  }, 4100);

  return () => {
    clearTimeout(exitTimer);
    clearTimeout(removeTimer);
  };
}, [openedFolderError]);




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

    const [
      ownedShares,
      receivedShares,
      ownedFolderShares,
      receivedFolderShares,
    ] = await Promise.all([
      getFileShares(user.id),
      getSharedWithMe(user.email),
      getFolderSharesByOwner(user.id),
      getSharedFoldersWithMe(user.email),
    ]);

    setSharedByMe(ownedShares);
    setSharedWithMe(receivedShares);
    setFoldersSharedByMe(ownedFolderShares);
    setFoldersSharedWithMe(receivedFolderShares);
  } catch (err) {
    console.error("Error loading shared items:", err);
    setError("Could not load shared items.");
  } finally {
    setLoading(false);
  }
}


async function openSharedFolder(folder, isChild = false) {
  if (!folder?.id) return;

  setOpenedFolderError("");
  setOpenedFolderErrorExiting(false);

  try {
    setSharedFolderLoading(true);
    setError("");

    if (isChild && currentSharedFolder) {
      setSharedFolderHistory((history) => [
        ...history,
        currentSharedFolder,
      ]);
    } else {
      setSharedFolderHistory([]);
    }

    // Preserve the original share's permissions while navigating
    // into nested folders.
    const rootShare = isChild
      ? currentSharedFolder
      : foldersSharedWithMe.find(
          (share) => share.folder_id === folder.id
        );

    const folderWithPermissions = {
      ...folder,
      share_id: rootShare?.share_id || rootShare?.id || folder.share_id,
      can_copy: rootShare?.can_copy ?? folder.can_copy ?? false,
      can_download:
        rootShare?.can_download ?? folder.can_download ?? false,
      can_edit: rootShare?.can_edit ?? folder.can_edit ?? false,
      folder_share_expires_at: rootShare?.expires_at ?? folder.folder_share_expires_at ?? null,
    };

    setCurrentSharedFolder(folderWithPermissions);

    const [subfolders, files] = await Promise.all([
      getSubfolders(folder.id),
      getFilesInFolder(folder.id),
    ]);

    setSharedFolderFolders(
  subfolders.map((subfolder) => ({
    ...subfolder,
    folder_share_id: folderWithPermissions.share_id,
    folder_share_expires_at: folderWithPermissions.folder_share_expires_at,
    can_copy: folderWithPermissions.can_copy,
    can_download: folderWithPermissions.can_download,
    can_edit: folderWithPermissions.can_edit,
  }))
);

setSharedFolderFiles(
  files.map((file) => ({
    ...file,
    folder_share_id: folderWithPermissions.share_id,
    folder_share_expires_at: folderWithPermissions.folder_share_expires_at,
    can_copy: folderWithPermissions.can_copy,
    can_download: folderWithPermissions.can_download,
    can_edit: folderWithPermissions.can_edit,
  }))
);
  } catch (err) {
    console.error("Error opening shared folder:", err);
    setSharedFolderFolders([]);
    setSharedFolderFiles([]);
    setError(
      "Could not open this folder. Check the folder and file access permissions."
    );
  } finally {
    setSharedFolderLoading(false);
  }
}


async function goBackSharedFolder() {
  if (sharedFolderHistory.length === 0) {
    closeSharedFolder();
    return;
  }

  const parentFolder =
    sharedFolderHistory[sharedFolderHistory.length - 1];

  setSharedFolderHistory((history) => history.slice(0, -1));

  try {
    setSharedFolderLoading(true);
    setError("");
    setCurrentSharedFolder(parentFolder);

    const [subfolders, files] = await Promise.all([
      getSubfolders(parentFolder.id),
      getFilesInFolder(parentFolder.id),
    ]);

    setSharedFolderFolders(subfolders);
    setSharedFolderFiles(files);
  } catch (err) {
    console.error("Error returning to parent folder:", err);
    setError("Could not load the parent folder.");
  } finally {
    setSharedFolderLoading(false);
  }
}

function closeSharedFolder() {
  setCurrentSharedFolder(null);
  setSharedFolderHistory([]);
  setSharedFolderFolders([]);
  setSharedFolderFiles([]);
  setError("");
}


async function handlePreview(file, share = null) {
  try {
    if (share?.expires_at && new Date(share.expires_at) <= new Date()) {
      setFileError(
        "This share has expired. Ask the owner to share the file again."
      );
      return;
    }

    if (
      file?.folder_share_expires_at &&
      new Date(file.folder_share_expires_at) <= new Date()
    ) {
      setOpenedFolderError(
        "This folder share has expired. Ask the owner to share the folder again."
      );
      return;
    }

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



async function handleDownload(file, share = null) {
  try {
    if (share?.expires_at && new Date(share.expires_at) <= new Date()) {
      const message =
        "This share has expired. Ask the owner to share the file again.";

      if (share.folder_share_id || file.folder_share_id) {
        setOpenedFolderError(message);
      } else {
        setFileError(message);
      }
      return;
    }

    if (
      file?.folder_share_expires_at &&
      new Date(file.folder_share_expires_at) <= new Date()
    ) {
      setOpenedFolderError(
        "This folder share has expired. Ask the owner to share the folder again."
      );
      return;
    }

    const options = file.folder_share_id
      ? { folderShareId: file.folder_share_id }
      : share?.id
        ? { shareId: share.id }
        : {};

    await downloadFile(file.storage_path, file.name, options);
  } catch (err) {
    console.error("Download error:", err);
    const message = err.message || "Could not download this file.";

    if (file.folder_share_id) {
      setOpenedFolderError(message);
    } else {
      setFileError(message);
    }
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


async function openCopyModal(item, type) {
  if (!item || !user?.id) return;

  try {
    setLoadingDestinations(true);
    setError("");
    setCopyMessage("");
    setCopyTarget({ item, type });
    setSelectedDestination("");

    const folders = await getUserFolders(user.id);
    setDestinationFolders(folders);
  } catch (err) {
    console.error("Could not load destination folders:", err);
    setError("Could not load your destination folders.");
    setCopyTarget(null);
  } finally {
    setLoadingDestinations(false);
  }
}

function handleCopySharedFile(file) {
  openCopyModal(file, "file");
}

function handleCopySharedFolder(folder) {
  openCopyModal(folder, "folder");
}

async function confirmCopy() {
  if (!copyTarget || !user?.id || loadingDestinations) return;

  const destinationFolderId = selectedDestination || null;
  const { item, type } = copyTarget;

  try {
    setCopyingItem(item.id);
    setCopyMessage("");
    setError("");

    if (type === "file") {
      await copySharedFile(item, user.id, destinationFolderId,
  item.folder_share_id
    ? { folderShareId: item.folder_share_id }
    : { shareId: item.share_id }
);
      setCopyMessage(
        `"${item.name}" was copied to ${
          destinationFolderId
            ? destinationFolders.find(
                (folder) => folder.id === destinationFolderId
              )?.name || "the selected folder"
            : "My Files"
        }.`
      );
    } else {
      const result = await copySharedFolder(
  item,
  user.id,
  destinationFolderId,
  {
    shareId: item.share_id,
  }
);

      setCopyMessage(
        `"${item.name}" was copied successfully, including ${
          result.copiedFileCount
        } file(s).`
      );
    }

    setCopyTarget(null);
    setSelectedDestination("");

} catch (err) {
  console.error("Error copying shared item:", err);

  const message = err.message || "Could not copy this item.";

  if (copyTarget?.type === "folder") {
    setFolderError(message);
  } else if (copyTarget?.item?.folder_share_id) {
    setOpenedFolderError(message);
  } else {
    setFileError(message);
  }
} finally {

    setCopyingItem(null);
  }
}



async function handleFolderRevoke() {
  if (!folderRevokeTarget) return;

  try {
    await revokeFolderShare(folderRevokeTarget.id);

    setFoldersSharedByMe((current) =>
      current.filter((share) => share.id !== folderRevokeTarget.id)
    );

    setFolderRevokeTarget(null);
  } catch (err) {
    console.error("Error revoking folder share:", err);
    setError("Could not revoke folder access.");
  }
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

        {copyMessage && (
  <div className="shared-success" role="status">
    {copyMessage}
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
                <h2>Files shared by you</h2>
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
  className="shared-item shared-clickable-item"
  key={share.id}
  onClick={() => file && handlePreview(file)}
  role="button"
  tabIndex={file ? 0 : -1}
  onKeyDown={(event) => {
    if (file && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      handlePreview(file);
    }
  }}
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
                        onClick={(event) => {
  event.stopPropagation();
  handleDownload(file);
}}
                        title="Download"
                      >
                        <Download size={17} />
                      </button>

                      <button
                        className="shared-revoke-btn"
                        onClick={(event) => {
  event.stopPropagation();
  setRevokeTarget(share);
}}
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

        
{/* FOLDERS SHARED BY YOU */}
<section className="shared-section">
  <div className="shared-section-header">
    <div className="shared-section-title">
      <div className="shared-section-icon">
        <Share2 size={18} />
      </div>
      <div>
        <h2>Folders shared by you</h2>
        <p>Folders you've shared with other people.</p>
      </div>
    </div>

    <span className="shared-count">
      {foldersSharedByMe.length}
      <span>
        {foldersSharedByMe.length === 1 ? " folder" : " folders"}
      </span>
    </span>
  </div>

  {foldersSharedByMe.length === 0 ? (
    <div className="shared-empty">
      <div className="shared-empty-icon">
        <Share2 size={22} />
      </div>
      <h3>No shared folders yet</h3>
      <p>Folders you share with others will appear here.</p>
    </div>
  ) : (
    <div className="shared-list">
      {foldersSharedByMe.map((share) => (
        <div className="shared-item" key={share.id}>
          <div className="shared-file-icon">
            <File size={20} />
          </div>

          <div className="shared-file-info">
            <h3>{share.folders?.name || "Unknown folder"}</h3>
            <p>Shared {formatDate(share.created_at)}</p>
          </div>

          <div className="shared-role">
            <UserRound size={15} />
            <div>
              <span className="shared-role-label">Shared with</span>
              <strong>{share.shared_with_email}</strong>
            </div>
          </div>

          <div className="shared-item-actions">
            <button
              className="shared-revoke-btn"
              onClick={(event) => {
                event.stopPropagation();
                setFolderRevokeTarget(share);
              }}
            >
              Revoke
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</section>


{/* FOLDERS SHARED WITH YOU */}
<section className="shared-section">
  <div className="shared-section-header">
    <div className="shared-section-title">
      <div className="shared-section-icon">
        <UserRound size={18} />
      </div>

      <div className="shared-folder-heading">
  <h2>
    {currentSharedFolder
      ? currentSharedFolder.name
      : "Folders shared with you"}
  </h2>

  <p>
    {currentSharedFolder
      ? "Browse the folders and files shared with you."
      : "Folders other people have shared with your account."}
  </p>

  {!currentSharedFolder && folderError && (
    <div
      className={`shared-error ${
        folderErrorExiting
          ? "shared-error-exit"
          : "shared-error-visible"
      }`}
      role="alert"
    >
      <span className="shared-error-icon">!</span>
      <span>{folderError}</span>
    </div>
  )}
</div>

      </div>
  

    <span className="shared-count">
      {currentSharedFolder
        ? sharedFolderFolders.length + sharedFolderFiles.length
        : foldersSharedWithMe.length}
      <span> items</span>
    </span>
  </div>

  {currentSharedFolder ? (
    <>
      <button
        type="button"
        className="shared-action-btn"
        onClick={goBackSharedFolder}
        title="Go back"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          width: "auto",
          padding: "8px 12px",
          marginBottom: "16px",
        }}
      >
        <ChevronLeft size={17} />
        Back
      </button>

      {openedFolderError && (
  <div
    className={`shared-error ${
      openedFolderErrorExiting ? "exiting" : ""
    }`}
    role="alert"
  >
    {openedFolderError}
  </div>
)}

      {sharedFolderLoading ? (
        <NovaLoader message="Opening shared folder..." />
      ) : sharedFolderFolders.length === 0 &&
        sharedFolderFiles.length === 0 ? (
        <div className="shared-empty">
          <div className="shared-empty-icon">
            <Folder size={22} />
          </div>
          <h3>This folder is empty</h3>
          <p>There are no accessible items in this folder.</p>
        </div>
      ) : (
        <div className="shared-list">
          {sharedFolderFolders.map((folder) => (
            <button
              type="button"
              className="shared-item"
              key={`folder-${folder.id}`}
              onClick={() => openSharedFolder(folder, true)}
              style={{
                width: "100%",
                textAlign: "left",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              <div className="shared-file-icon">
                <Folder size={20} />
              </div>

              <div className="shared-file-info">
                <h3>{folder.name}</h3>
                <p>Folder</p>
              </div>

              <div className="shared-item-actions">
                <ChevronLeft
                  size={17}
                  style={{ transform: "rotate(180deg)" }}
                />
              </div>
            </button>
          ))}

          {sharedFolderFiles.map((file) => {
            const Icon = getFileIcon(file.mime_type);

            return (
              <div
  className="shared-item shared-clickable-item"
  key={`file-${file.id}`}
  onClick={() => handlePreview(file)}
  role="button"
  tabIndex={0}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePreview(file);
    }
  }}
>
                <div className="shared-file-icon">
                  <Icon size={20} />
                </div>

                <div className="shared-file-info">
                  <h3>{file.name}</h3>
                  <p>
                    {formatFileSize(file.size_bytes)}
                    <span> · </span>
                    {formatDate(file.created_at)}
                  </p>
                </div>

                <div className="shared-item-actions">
                  
                  <button
  className="shared-action-btn"
 
onClick={(event) => {
  event.stopPropagation();


if (
  file.folder_share_expires_at &&
  new Date(file.folder_share_expires_at) <= new Date()
) {
  setOpenedFolderError(
    "This folder share has expired. Ask the owner to share the folder again."
  );
  return;
}

if (!currentSharedFolder?.can_copy) {
  setOpenedFolderError(
    "The owner has disabled copying for this folder."
  );
  return;
}

setOpenedFolderError("");
handleCopySharedFile(file);
}}
title={
  !currentSharedFolder?.can_copy
    ? "The owner has disabled copying"
    : "Add to My Files"
}

>
  <Copy size={17} />
</button>

<button
                    type="button"
                    className="shared-action-btn"
                    
onClick={(event) => {
  event.stopPropagation();

  
if (
  file.folder_share_expires_at &&
  new Date(file.folder_share_expires_at) <= new Date()
) {
  setOpenedFolderError(
    "This folder share has expired. Ask the owner to share the folder again."
  );
  return;
}


  if (!currentSharedFolder?.can_download) {
    setOpenedFolderError(
  "The owner has disabled downloading for this folder."
);
    return;
  }

  setOpenedFolderError("");
  handleDownload(file, {
  folder_share_id: file.folder_share_id,
  expires_at: file.folder_share_expires_at,
});
}}
title={
  !currentSharedFolder?.can_download
    ? "The owner has disabled downloading"
    : "Download"
}

                  >
                    <Download size={17} />
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  ) : foldersSharedWithMe.length === 0 ? (
    <div className="shared-empty">
      <div className="shared-empty-icon">
        <UserRound size={22} />
      </div>
      <h3>No shared folders</h3>
      <p>Folders shared with your account will appear here.</p>
    </div>
  ) : (
    <div className="shared-list">
      {foldersSharedWithMe.map((share) => (
        
        <div className="shared-item" key={share.id}>
          <button
            type="button"
            onClick={() => {
              if (share.folders) {
                openSharedFolder(share.folders);
              }
            }}
            style={{
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flex: 1,
  minWidth: 0,
  border: 0,
  background: "transparent",
  font: "inherit",
  textAlign: "left",
  color: "inherit",
  cursor: "pointer",
  padding: "0 12px 0 0",
}}
          >
            <div className="shared-file-icon">
              <Folder size={20} />
            </div>

            <div className="shared-file-info">
              <h3>{share.folders?.name || "Unknown folder"}</h3>
              <p>Shared {formatDate(share.created_at)}</p>
            </div>

            <div className="shared-role">
              <UserRound size={15} />
              <div>
                <span className="shared-role-label">Access</span>
                <strong>Shared with you</strong>
              </div>
            </div>
          </button>

          <div className="shared-item-actions">
            

<button
  type="button"
  className="shared-action-btn"
  onClick={(event) => {
    event.stopPropagation();

    if (share.expires_at && new Date(share.expires_at) <= new Date()) {
  setFolderError(
    "This folder share has expired. Ask the owner to share the folder again."
  );
  return;
}

if (!share.can_copy) {
  setFolderError("The owner has disabled copying for this folder.");
  return;
}

setFolderError("");

    handleCopySharedFolder({
      ...share.folders,
      share_id: share.id,
      can_copy: share.can_copy,
    });
  }}
  disabled={copyingItem === share.folders?.id || !share.folders}
  title={
    !share.can_copy
      ? "The owner has disabled copying"
      : "Add folder to My Files"
  }
>
  <Copy size={17} />
</button>


<button
  type="button"
  className="shared-action-btn"
  onClick={async (event) => {
    event.stopPropagation();

    if (share.expires_at && new Date(share.expires_at) <= new Date()) {
  setFolderError(
    "This folder share has expired. Ask the owner to share the folder again."
  );
  return;
}

if (!share.can_download) {
  setFolderError("The owner has disabled downloading for this folder.");
  return;
}

setFolderError("");

    try {
      setCopyingItem(share.folders?.id);

      await downloadSharedFolderAsZip({
        ...share.folders,
        share_id: share.id,
      });
    } catch (err) {
  console.error("Folder download error:", err);
  setFolderError(err.message || "Could not download this folder.");
} finally {
      setCopyingItem(null);
    }
  }}
  disabled={copyingItem === share.folders?.id || !share.folders}
  title={
    !share.can_download
      ? "The owner has disabled downloading"
      : "Download folder as ZIP"
  }
>
  <Download size={17} />
</button>



          </div>
        </div>

      ))}
    </div>
  )}
</section>



        {/* =========================================
           FILES SHARED WITH YOU
        ========================================= */}

        <section className="shared-section">

          <div className="shared-section-header">
            <div className="shared-section-title">
              <div className="shared-section-icon">
                <UserRound size={18} />
              </div>

              <div>
                <h2>Files shared with you</h2>
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

          


{fileError && (
  <div
    className={`shared-error ${
      fileErrorExiting
        ? "shared-error-exit"
        : "shared-error-visible"
    }`}
    role="alert"
  >
    <span className="shared-error-icon">!</span>
    <span>{fileError}</span>
  </div>
)}




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
  className="shared-item shared-clickable-item"
  key={share.id}
  onClick={() => file && handlePreview(file, share)}
  role="button"
  tabIndex={file ? 0 : -1}
  onKeyDown={(event) => {
    if (file && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      handlePreview(file, share);
    }
  }}
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
  type="button"
  className="shared-action-btn"

onClick={(event) => {
  event.stopPropagation();

  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
    setFileError(
      "This share has expired. Ask the owner to share the file again."
    );
    return;
  }

  if (!share.can_copy) {
    setFileError("The owner has disabled copying for this file.");
    return;
  }

  setFileError("");
  handleCopySharedFile({
    ...file,
    share_id: share.id,
    can_copy: share.can_copy,
  });
}}

  disabled={copyingItem === file?.id || !file}
  title={
    !share.can_copy
      ? "The owner has disabled copying"
      : "Add to My Files"
  }
>
  <Copy size={17} />
</button>

<button
  type="button"
  className="shared-action-btn"
  onClick={(event) => {
    event.stopPropagation();

    
if (share.expires_at && new Date(share.expires_at) <= new Date()) {
  setFileError(
    "This share has expired. Ask the owner to share the file again."
  );
  return;
}


    if (!share.can_download) {
  setFileError("The owner has disabled downloading for this file.");
  return;
}

setFileError("");

    handleDownload(file, share);
  }}
  disabled={copyingItem === file?.id}
  title={
    !share.can_download
      ? "The owner has disabled downloading"
      : "Download"
  }
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

      
{folderRevokeTarget && (
  <div
    className="shared-modal-overlay"
    onClick={() => setFolderRevokeTarget(null)}
  >
    <div
      className="shared-modal"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="shared-modal-close"
        onClick={() => setFolderRevokeTarget(null)}
        aria-label="Close"
      >
        <X size={18} />
      </button>

      <div className="shared-modal-icon">
        <Share2 size={20} />
      </div>

      <h2>Revoke folder access?</h2>

      <p>
        <strong>
          {folderRevokeTarget.folders?.name || "This folder"}
        </strong>{" "}
        will no longer be shared with{" "}
        <strong>{folderRevokeTarget.shared_with_email}</strong>.
      </p>

      <div className="shared-modal-actions">
        <button
          className="shared-cancel-btn"
          onClick={() => setFolderRevokeTarget(null)}
        >
          Cancel
        </button>

        <button
          className="shared-confirm-btn"
          onClick={handleFolderRevoke}
        >
          Revoke access
        </button>
      </div>
    </div>
  </div>
)}


{/* COPY DESTINATION MODAL */}


{copyTarget && (
  <div
    className="folder-copy-overlay"
    onClick={() => {
      if (!copyingItem) setCopyTarget(null);
    }}
  >
    <div
      className="folder-copy-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-copy-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="folder-copy-modal-header">
        <div>
          <h2 id="shared-copy-title">
            Copy {copyTarget.type === "folder" ? "folder" : "file"}
          </h2>
          <p>
            Choose where to save the copy of "{copyTarget.item.name}".
          </p>
        </div>

        <button
          type="button"
          className="folder-copy-close"
          onClick={() => setCopyTarget(null)}
          disabled={Boolean(copyingItem)}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      <div className="folder-copy-destinations">
        <label
          className="folder-copy-option"
          data-selected={selectedDestination === ""}
        >
          <input
            type="radio"
            name="shared-copy-destination"
            checked={selectedDestination === ""}
            onChange={() => setSelectedDestination("")}
          />

          <Folder size={19} />

          <span>
            <strong>My Files</strong>
            <small>Root directory</small>
          </span>
        </label>

        {loadingDestinations ? (
          <p>Loading folders...</p>
        ) : destinationFolders.length === 0 ? (
          <p>You don't have any folders yet.</p>
        ) : (
          destinationFolders.map((folder) => (
            <label
              key={folder.id}
              className="folder-copy-option"
              data-selected={selectedDestination === folder.id}
            >
              <input
                type="radio"
                name="shared-copy-destination"
                checked={selectedDestination === folder.id}
                onChange={() => setSelectedDestination(folder.id)}
              />

              <Folder size={19} />

              <span>
                <strong>{folder.name}</strong>
                <small>
                  {getDestinationFolderPath(folder, destinationFolders)}
                </small>
              </span>
            </label>
          ))
        )}
      </div>

      <div className="folder-copy-modal-actions">
        <button
          type="button"
          className="bulk-clear-button"
          onClick={() => setCopyTarget(null)}
          disabled={Boolean(copyingItem)}
        >
          Cancel
        </button>

        <button
          type="button"
          className="bulk-copy-button"
          onClick={confirmCopy}
          disabled={Boolean(copyingItem) || loadingDestinations}
        >
          <Copy size={16} />
          {copyingItem ? "Copying..." : "Copy here"}
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
onDownload={() => {
  const share = sharedWithMe.find(
    (item) => item.file_id === previewFile.id
  );

  
  if (
    (share?.expires_at &&
      new Date(share.expires_at) <= new Date()) ||
    (previewFile.folder_share_expires_at &&
      new Date(previewFile.folder_share_expires_at) <= new Date())
  ) {
    if (previewFile.folder_share_id) {
      setOpenedFolderError(
        "This folder share has expired. Ask the owner to share the folder again."
      );
    } else {
      setFileError(
        "This share has expired. Ask the owner to share the file again."
      );
    }

    closePreview();
    return;
  }


  if (share && !share.can_download) {
    setFileError(
      "The owner has disabled downloading for this file."
    );
    closePreview();
    return;
  }

  if (
    previewFile.folder_share_id &&
    !previewFile.can_download
  ) {
    setOpenedFolderError(
      "The owner has disabled downloading for this folder."
    );
    closePreview();
    return;
  }

  handleDownload(
    previewFile,
    share || {
      folder_share_id: previewFile.folder_share_id,
      expires_at: previewFile.folder_share_expires_at,
    }
  );
}}
          loading={previewLoading}
        />
      )}
    </main>
  );
}

export default Shared;