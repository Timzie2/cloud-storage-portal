import NovaLoader from "../components/NovaLoader";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  Pencil,
  Plus,
  Star,
  Copy,
  CheckSquare,
  Square,
  X,
  Ellipsis,
  Info,
  ArrowLeft,
} from "lucide-react";


import { useAuth } from "../context/AuthContext";
import {
  getUserFiles,
  downloadFile,
  deleteFile,
  getPreviewUrl,
  shareFile,
  moveFile,
  toggleFavorite,
  makeFileCopy,
} from "../services/files";

import { supabase } from "../services/supabase";

import FilePreviewModal from "../components/FilePreviewModal";
import UploadCard from "../components/UploadCard";
import ShareFileModal from "../components/ShareFileModal";
import FileDetailsModal from "../components/FileDetailsModal";
import ShareFolderModal from "../components/ShareFolderModal";


import {
  getUserFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  copyFolder,
  moveFolder,
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
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkMoveMode, setBulkMoveMode] = useState(false);
  const [bulkCopyMode, setBulkCopyMode] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [folders, setFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [openFolderMenu, setOpenFolderMenu] = useState(null);
  const [folderMenuPosition, setFolderMenuPosition] = useState(null);
  const [folderDownloadProgress, setFolderDownloadProgress] = useState(null);

  

  

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
  const [detailsFile, setDetailsFile] = useState(null);
  const [copyingFile, setCopyingFile] = useState(null);
  const [showCopyFoldersModal, setShowCopyFoldersModal] = useState(false);
  const [folderCopyDestination, setFolderCopyDestination] = useState("");
  const [showMoveFoldersModal, setShowMoveFoldersModal] = useState(false);
  const [folderMoveDestination, setFolderMoveDestination] = useState("");
  const [fileMoveDestination, setFileMoveDestination] = useState("");
  const [fileCopyDestination, setFileCopyDestination] = useState("");
  const [renameFolderData, setRenameFolderData] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [folderDetailsData, setFolderDetailsData] = useState(null);
  const [shareFolderData, setShareFolderData] = useState(null);
  const [shareFolderEmail, setShareFolderEmail] = useState("");
  const [sharingFolder, setSharingFolder] = useState(false);


  const [shareFileData, setShareFileData] = useState(null);

  const [moveFileData, setMoveFileData] = useState(null);
  const [movingFile, setMovingFile] = useState(false);
  const [copyFileData, setCopyFileData] = useState(null);
  const [copyingToFolder, setCopyingToFolder] = useState(false);
  const [renameFileData, setRenameFileData] = useState(null);
  const [renameFileName, setRenameFileName] = useState("");
  const [renameFileExtension, setRenameFileExtension] = useState("");
  const [renamingFile, setRenamingFile] = useState(false);

  const menuRef = useRef(null);
  const activeButtonRef = useRef(null);


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

useEffect(() => {
  loadFilesAndFolders();
}, [user]);

// Close the folder menu when clicking anywhere outside it.

useEffect(() => {
  if (!openFolderMenu) return;

  const handleFolderOutsideClick = (event) => {
    if (
      !event.target.closest(".folder-card-actions") &&
      !event.target.closest(".folder-actions-menu")
    ) {
      setOpenFolderMenu(null);
      setFolderMenuPosition(null);
    }
  };

  document.addEventListener("mousedown", handleFolderOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleFolderOutsideClick);
  };
}, [openFolderMenu]);


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

  
useEffect(() => {
  if (!openFolderMenu) return;

  const updateFolderMenuPosition = () => {
    const button = document.querySelector(
      `[data-folder-menu-trigger="${openFolderMenu}"]`
    );

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 190;
    const menuHeight = 150;
    const gap = 6;
    const padding = 12;

    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;

    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - gap;
    }

    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - menuWidth - padding)
    );

    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - menuHeight - padding)
    );

    setFolderMenuPosition({ top, left });
  };

  window.addEventListener("scroll", updateFolderMenuPosition, true);
  window.addEventListener("resize", updateFolderMenuPosition);

  return () => {
    window.removeEventListener("scroll", updateFolderMenuPosition, true);
    window.removeEventListener("resize", updateFolderMenuPosition);
  };
}, [openFolderMenu]);


  /*
   * Keep the floating menu positioned correctly
   * when the page is resized or scrolled.
   */
  

useEffect(() => {
  if (!openMenu) return;

  const updateMenuPosition = () => {
    const button = activeButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    const padding = 8;
    const gap = 6;
    const menuWidth = Math.min(232, window.innerWidth - padding * 2);
    const safeBottom = window.innerHeight - (isMobile ? 76 : padding);

    const menuHeight = Math.min(
      menuRef.current?.scrollHeight || 390,
      safeBottom - padding * 2
    );

    let left = rect.right - menuWidth;
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - menuWidth - padding)
    );

    const spaceBelow = safeBottom - rect.bottom - gap;
    const spaceAbove = rect.top - padding - gap;

    const openUpward =
      spaceBelow < menuHeight && spaceAbove > spaceBelow;

    let top = openUpward
      ? rect.top - menuHeight - gap
      : rect.bottom + gap;

    top = Math.max(
      padding,
      Math.min(top, safeBottom - menuHeight - padding)
    );

    const nextPosition = {
      top,
      left,
      maxHeight: Math.max(120, safeBottom - top - padding),
    };

    setMenuPosition((previous) => {
      if (
        previous &&
        Math.abs(previous.top - nextPosition.top) < 1 &&
        Math.abs(previous.left - nextPosition.left) < 1 &&
        Math.abs(previous.maxHeight - nextPosition.maxHeight) < 1
      ) {
        return previous;
      }

      return nextPosition;
    });
  };

  const frame = requestAnimationFrame(updateMenuPosition);

  window.addEventListener("resize", updateMenuPosition);
  window.addEventListener("scroll", updateMenuPosition, true);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", updateMenuPosition);
    window.removeEventListener("scroll", updateMenuPosition, true);
  };
}, [openMenu, menuPosition]);



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


const getFolderDisplayPath = (folder) => {
  const path = [];
  let current = folder;

  while (current) {
    path.unshift(current.name);

    current = current.parent_id
      ? folders.find((item) => item.id === current.parent_id)
      : null;
  }

  return path.join(" / ");
};


const selectedFiles = visibleFiles.filter((file) =>
  selectedFileIds.includes(file.id)
);

const allVisibleSelected =
  visibleFiles.length > 0 &&
  visibleFiles.every((file) =>
    selectedFileIds.includes(file.id)
  );

const toggleFileSelection = (fileId) => {
  setSelectedFileIds((current) =>
    current.includes(fileId)
      ? current.filter((id) => id !== fileId)
      : [...current, fileId]
  );
};

const toggleSelectAll = () => {
  setSelectedFileIds((current) => {
    if (allVisibleSelected) {
      return current.filter(
        (id) => !visibleFiles.some((file) => file.id === id)
      );
    }

    const next = new Set(current);

    visibleFiles.forEach((file) => next.add(file.id));

    return [...next];
  });
};

const clearSelection = () => {
  setSelectedFileIds([]);
};

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

  const toggleFolderSelection = (folderId) => {
  setSelectedFolderIds((current) =>
    current.includes(folderId)
      ? current.filter((id) => id !== folderId)
      : [...current, folderId]
  );
};

const visibleFolders = folders.filter(
  (folder) => folder.parent_id === currentFolderId
);

const allVisibleFoldersSelected =
  visibleFolders.length > 0 &&
  visibleFolders.every((folder) =>
    selectedFolderIds.includes(folder.id)
  );

const toggleSelectAllFolders = () => {
  if (allVisibleFoldersSelected) {
    setSelectedFolderIds((current) =>
      current.filter(
        (id) => !visibleFolders.some((folder) => folder.id === id)
      )
    );
  } else {
    setSelectedFolderIds((current) => [
      ...new Set([
        ...current,
        ...visibleFolders.map((folder) => folder.id),
      ]),
    ]);
  }
};

const clearFolderSelection = () => {
  setSelectedFolderIds([]);
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

      alert(
  error.message?.toLowerCase().includes("expired") ||
    error.message?.toLowerCase().includes("revoked")
    ? "This share has expired or been revoked. Ask the owner to share the file again."
    : "Could not open this file."
);
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


const handleToggleFavorite = async (file) => {
  try {
    const updatedFile = await toggleFavorite(
      file.id,
      !file.is_favorite
    );

    setFiles((currentFiles) =>
      currentFiles.map((item) =>
        item.id === updatedFile.id ? updatedFile : item
      )
    );

    setOpenMenu(null);
    setMenuPosition(null);
    activeButtonRef.current = null;
  } catch (error) {
    console.error("Favorite update error:", error);
    alert("Could not update favorite status. Please try again.");
  }
};



const handleMoveOpen = (file) => {
  setOpenMenu(null);
  setMenuPosition(null);
  activeButtonRef.current = null;
  setBulkMoveMode(false);
  setFileMoveDestination(file.folder_id ?? "");
  setMoveFileData(file);
};

const handleMakeCopy = (file) => {
  setOpenMenu(null);
  setMenuPosition(null);
  activeButtonRef.current = null;
  setBulkCopyMode(false);
  setFileCopyDestination("");
  setCopyFileData(file);
};

const handleBulkMoveOpen = () => {
  if (!selectedFiles.length) return;

  setOpenMenu(null);
  setMenuPosition(null);
  setBulkMoveMode(true);
  setMoveFileData(selectedFiles[0]);
};

const handleBulkCopyOpen = () => {
  if (!selectedFiles.length) return;

  setOpenMenu(null);
  setMenuPosition(null);
  setBulkCopyMode(true);
  setCopyFileData(selectedFiles[0]);
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

  if (!renameFileData || !user?.id || !renameFileName.trim()) {
    return;
  }

  const newBaseName = renameFileName.trim();
const newName = `${newBaseName}${renameFileExtension}`;

if (newName === renameFileData.name) {
    setRenameFileData(null);
    setRenameFileName("");
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

    setFiles((currentFiles) =>
      currentFiles.map((file) =>
        file.id === data.id ? data : file
      )
    );

    setRenameFileData(null);
    setRenameFileName("");
  } catch (error) {
    console.error("Rename file error:", error);
    alert("Could not rename the file. Please try again.");
  } finally {
    setRenamingFile(false);
  }
};

const closeShare = () => {
  setShareFileData(null);
};


const handleMove = async (folderId) => {
  if (!moveFileData) return;

  const filesToMove = bulkMoveMode
    ? [...selectedFiles]
    : [moveFileData];

  if (!filesToMove.length) return;

  setMovingFile(true);
  const successfulIds = [];

  try {
    for (const file of filesToMove) {
      try {
        await moveFile(file.id, folderId);
        successfulIds.push(file.id);
      } catch (error) {
        console.error(`Could not move ${file.name}:`, error);
      }
    }

    if (successfulIds.length > 0) {
      await loadFilesAndFolders();

      if (bulkMoveMode) {
        setSelectedFileIds((current) =>
          current.filter((id) => !successfulIds.includes(id))
        );
      }
    }

    if (successfulIds.length !== filesToMove.length) {
      alert(
        `${successfulIds.length} of ${filesToMove.length} files moved successfully.`
      );
    }

    setMoveFileData(null);
    setBulkMoveMode(false);
  } finally {
    setMovingFile(false);
  }
};

const handleCopyToFolder = async (folderId) => {
  if (!copyFileData || !user?.id) return;

  const filesToCopy = bulkCopyMode
    ? [...selectedFiles]
    : [copyFileData];

  if (!filesToCopy.length) return;

  setCopyingToFolder(true);
  let successfulCount = 0;

  try {
    for (const file of filesToCopy) {
      try {
        await makeFileCopy(file, user.id, folderId);
        successfulCount++;
      } catch (error) {
        console.error(`Could not copy ${file.name}:`, error);
      }
    }

    if (successfulCount > 0) {
      await loadFilesAndFolders();

      if (bulkCopyMode) {
        setSelectedFileIds([]);
      }
    }

    if (successfulCount !== filesToCopy.length) {
      alert(
        `${successfulCount} of ${filesToCopy.length} files copied successfully.`
      );
    }

    setCopyFileData(null);
    setBulkCopyMode(false);
  } finally {
    setCopyingToFolder(false);
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

const handleRenameFolder = async (event) => {
  event.preventDefault();

  if (
    !renameFolderData ||
    !user?.id ||
    !renameFolderName.trim() ||
    renamingFolder
  ) {
    return;
  }

  const newName = renameFolderName.trim();

  if (newName === renameFolderData.name) {
    setRenameFolderData(null);
    setRenameFolderName("");
    return;
  }

  setRenamingFolder(true);

  try {
    await renameFolder(renameFolderData.id, newName);

    setFolders((currentFolders) =>
      currentFolders.map((folder) =>
        folder.id === renameFolderData.id
          ? { ...folder, name: newName }
          : folder
      )
    );

    setRenameFolderData(null);
    setRenameFolderName("");
  } catch (error) {
    console.error("Rename folder error:", error);
    alert("Could not rename the folder. Please try again.");
  } finally {
    setRenamingFolder(false);
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

const handleBulkDeleteFolders = async () => {
  const foldersToDelete = visibleFolders.filter((folder) =>
    selectedFolderIds.includes(folder.id)
  );

  if (foldersToDelete.length === 0) return;

  const confirmed = window.confirm(
    `Move ${foldersToDelete.length} selected folder(s) and their nested folders to Trash?`
  );

  if (!confirmed) return;

  setBulkActionLoading(true);

  const successfulIds = [];
  const failedNames = [];

  try {
    for (const folder of foldersToDelete) {
      try {
        await deleteFolder(folder.id);
        successfulIds.push(folder.id);
      } catch (error) {
        console.error(`Could not delete folder ${folder.name}:`, error);
        failedNames.push(folder.name);
      }
    }

    setSelectedFolderIds([]);

    await loadFilesAndFolders();

    if (failedNames.length > 0) {
      alert(
        `Some folders could not be moved to Trash: ${failedNames.join(", ")}`
      );
    } else if (successfulIds.length > 0) {
      alert("Selected folders moved to Trash successfully.");
    }
  } finally {
    setBulkActionLoading(false);
  }
};



const handleBulkCopyFolders = () => {
  const foldersToCopy = visibleFolders.filter((folder) =>
    selectedFolderIds.includes(folder.id)
  );

  if (foldersToCopy.length === 0) return;

  setFolderCopyDestination("");
  setShowCopyFoldersModal(true);
};

const handleConfirmBulkCopyFolders = async () => {
  const foldersToCopy = visibleFolders.filter((folder) =>
    selectedFolderIds.includes(folder.id)
  );

  if (foldersToCopy.length === 0 || bulkActionLoading) return;

  setBulkActionLoading(true);

  const successfulFolders = [];
  const failedFolders = [];

  try {
    for (const folder of foldersToCopy) {
      try {
        await copyFolder(
          folder.id,
          user.id,
          folderCopyDestination || null
        );

        successfulFolders.push(folder.name);
      } catch (error) {
        console.error(`Could not copy "${folder.name}":`, error);
        failedFolders.push(folder.name);
      }
    }

    setShowCopyFoldersModal(false);
    setSelectedFolderIds([]);
    await loadFilesAndFolders();

    if (failedFolders.length > 0) {
      alert(
        `Could not fully copy these folders: ${failedFolders.join(", ")}. Check the console for details.`
      );
    } else if (successfulFolders.length > 0) {
      alert("Selected folders copied successfully.");
    }
  } finally {
    setBulkActionLoading(false);
  }
};


const handleBulkMoveFolders = () => {
  const foldersToMove = visibleFolders.filter((folder) =>
    selectedFolderIds.includes(folder.id)
  );

  if (foldersToMove.length === 0) return;

  setFolderMoveDestination("");
  setShowMoveFoldersModal(true);
};

const handleConfirmBulkMoveFolders = async () => {
  const foldersToMove = visibleFolders.filter((folder) =>
    selectedFolderIds.includes(folder.id)
  );

  if (foldersToMove.length === 0 || bulkActionLoading) return;

  setBulkActionLoading(true);

  const successfulIds = [];
  const failedNames = [];

  try {
    for (const folder of foldersToMove) {
      try {
        await moveFolder(
          folder.id,
          user.id,
          folderMoveDestination || null
        );

        successfulIds.push(folder.id);
      } catch (error) {
        console.error(`Could not move "${folder.name}":`, error);
        failedNames.push(folder.name);
      }
    }

    setShowMoveFoldersModal(false);
    setSelectedFolderIds([]);

    // If we moved the folder currently being viewed, return to My Files.
    if (currentFolderId && successfulIds.includes(currentFolderId)) {
      setCurrentFolderId(null);
    }

    await loadFilesAndFolders();

    if (failedNames.length > 0) {
      alert(`Some folders could not be moved: ${failedNames.join(", ")}.`);
    } else if (successfulIds.length > 0) {
      alert("Selected folders moved successfully.");
    }
  } finally {
    setBulkActionLoading(false);
  }
};

  const handleDownload = async (file) => {
    try {
      setOpenMenu(null);
      setMenuPosition(null);

      await downloadFile(file.storage_path, file.name);
    } catch (error) {
      console.error("Download error:", error);
      alert("Could not download this file.");
    }
  };

  

const handleDownloadFolder = async (folder) => {
  setOpenFolderMenu(null);
  setFolderMenuPosition(null);

  const failedFiles = [];

  try {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const getFolderAndDescendantIds = (folderId) => {
      const descendantIds = new Set([folderId]);
      let foundNewFolder = true;

      while (foundNewFolder) {
        foundNewFolder = false;

        folders.forEach((item) => {
          if (
            descendantIds.has(item.parent_id) &&
            !descendantIds.has(item.id)
          ) {
            descendantIds.add(item.id);
            foundNewFolder = true;
          }
        });
      }

      return descendantIds;
    };

    const getRelativeFolderPath = (childFolder) => {
      const path = [];
      let current = childFolder;

      while (current && current.id !== folder.id) {
        path.unshift(current.name);

        current = current.parent_id
          ? folders.find((item) => item.id === current.parent_id)
          : null;
      }

      return path.join("/");
    };

    const folderIds = getFolderAndDescendantIds(folder.id);

    const foldersToInclude = folders.filter((item) =>
      folderIds.has(item.id)
    );

    const filesToDownload = files.filter((file) =>
      folderIds.has(file.folder_id)
    );

    setFolderDownloadProgress({
      folderName: folder.name,
      stage: "downloading",
      totalFiles: filesToDownload.length,
      completedFiles: 0,
      failedFiles: [],
      percent: 0,
    });

    // Add every subfolder, including empty folders.
    foldersToInclude.forEach((item) => {
      if (item.id === folder.id) return;

      const relativePath = getRelativeFolderPath(item);

      if (relativePath) {
        zip.folder(relativePath);
      }
    });

    // Ensure an entirely empty folder still produces a meaningful ZIP.
    if (filesToDownload.length === 0 && foldersToInclude.length === 1) {
      zip.folder(folder.name);
    }

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];

      try {
        const { data, error } = await supabase.storage
          .from("user-files")
          .download(file.storage_path);

        if (error || !data) {
          throw error || new Error("No file data was returned.");
        }

        const parentFolder = folders.find(
          (item) => item.id === file.folder_id
        );

        const relativeFolderPath =
          parentFolder && parentFolder.id !== folder.id
            ? getRelativeFolderPath(parentFolder)
            : "";

        const relativePath = relativeFolderPath
          ? `${relativeFolderPath}/${file.name}`
          : file.name;

        zip.file(relativePath, data);
      } catch (error) {
        console.error(`Could not download ${file.name}:`, error);
        failedFiles.push(file.name);
      }

      setFolderDownloadProgress({
        folderName: folder.name,
        stage: "downloading",
        totalFiles: filesToDownload.length,
        completedFiles: i + 1,
        failedFiles: [...failedFiles],
        percent:
          filesToDownload.length > 0
            ? Math.round(((i + 1) / filesToDownload.length) * 90)
            : 90,
      });
    }

    setFolderDownloadProgress({
      folderName: folder.name,
      stage: "zipping",
      totalFiles: filesToDownload.length,
      completedFiles: filesToDownload.length,
      failedFiles: [...failedFiles],
      percent: 90,
    });

    const blob = await zip.generateAsync(
      { type: "blob" },
      (metadata) => {
        setFolderDownloadProgress({
          folderName: folder.name,
          stage: "zipping",
          totalFiles: filesToDownload.length,
          completedFiles: filesToDownload.length,
          failedFiles: [...failedFiles],
          percent: 90 + Math.round(metadata.percent / 10),
        });
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${folder.name}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setFolderDownloadProgress({
      folderName: folder.name,
      stage: "complete",
      totalFiles: filesToDownload.length,
      completedFiles: filesToDownload.length,
      failedFiles: [...failedFiles],
      percent: 100,
    });
  } catch (error) {
    console.error("Folder download error:", error);

    setFolderDownloadProgress({
      folderName: folder.name,
      stage: "error",
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: [...failedFiles],
      percent: 0,
      message: "Could not create the ZIP file. Please try again.",
    });
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

  const handleBulkDelete = async () => {
  if (selectedFiles.length === 0 || bulkActionLoading) return;

  const confirmed = window.confirm(
    `Move ${selectedFiles.length} selected files to Trash?`
  );

  if (!confirmed) return;

  setBulkActionLoading(true);

  const successfulIds = [];

  try {
    for (const file of selectedFiles) {
      try {
        await deleteFile(file);
        successfulIds.push(file.id);
      } catch (error) {
        console.error(`Could not delete ${file.name}:`, error);
      }
    }

    if (successfulIds.length > 0) {
      setFiles((current) =>
        current.filter((file) => !successfulIds.includes(file.id))
      );

      setSelectedFileIds((current) =>
        current.filter((id) => !successfulIds.includes(id))
      );
    }

    if (successfulIds.length !== selectedFiles.length) {
      alert(
        `${successfulIds.length} of ${selectedFiles.length} files moved to Trash. Some files could not be deleted.`
      );
    }
  } finally {
    setBulkActionLoading(false);
  }
};

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  };

  if (loading || loadingFolders) {
  return <NovaLoader message="Loading your files..." />;
}

  return (
    <main className="dashboard files-page">
      <section className="dashboard-content">

        <div className="files-page-header">
  <div className="files-page-title">
    
{currentFolderId && (
  <div className="files-navigation">
    <button
      type="button"
      className="files-back-button"
      onClick={() => {
        const currentFolder = folders.find(
          (folder) => folder.id === currentFolderId
        );

        setCurrentFolderId(currentFolder?.parent_id ?? null);
      }}
    >
      <ArrowLeft size={16} />
      <span>Back</span>
    </button>

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

        <div className="files-upload-section">
  <UploadCard
    folderId={currentFolderId}
    onUploadComplete={async () => {
      await loadFilesAndFolders();
    }}
  />
</div>

        {!loadingFolders && folders.filter(
  (folder) => folder.parent_id === currentFolderId
).length > 0 && (
  
  <div className="folders-section">

<div className="folders-section-header">
  <h2>Folders</h2>

  {visibleFolders.length > 0 && (
    <label className="bulk-select-all">
      <input
        type="checkbox"
        checked={allVisibleFoldersSelected}
        onChange={toggleSelectAllFolders}
        aria-label="Select all visible folders"
      />
      <span>Select all</span>
    </label>
  )}
</div>

{selectedFolderIds.length > 0 && (
  <div className="bulk-selection-toolbar">
    <div className="bulk-selection-actions">
      <span className="bulk-selection-count">
        {selectedFolderIds.length}{" "}
        {selectedFolderIds.length === 1 ? "folder" : "folders"} selected
      </span>

<button
  type="button"
  className="bulk-copy-button"
  onClick={handleBulkCopyFolders}
  disabled={bulkActionLoading}
>
  <Copy size={16} />
  Copy
</button>

<button
  type="button"
  className="bulk-move-button"
  onClick={handleBulkMoveFolders}
  disabled={bulkActionLoading}
>
  <Folder size={16} />
  Move
</button>

<button
  type="button"
  className="bulk-delete-button"
  onClick={handleBulkDeleteFolders}
  disabled={bulkActionLoading}
>
  <Trash2 size={16} />
  {bulkActionLoading ? "Deleting..." : "Delete"}
</button>

      <button
        type="button"
        className="bulk-clear-button"
        onClick={clearFolderSelection}
      >
        <X size={16} />
        Clear
      </button>
    </div>
  </div>
)}

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

  <label
  className="folder-selection-checkbox"
  onClick={(event) => event.stopPropagation()}
>
  <input
    type="checkbox"
    checked={selectedFolderIds.includes(folder.id)}
    onChange={() => toggleFolderSelection(folder.id)}
    aria-label={`Select folder ${folder.name}`}
  />
</label>

  <button
    type="button"
    className="folder-card-main"
    onClick={() => setCurrentFolderId(folder.id)}
  >
    <Folder size={22} />

    <span>{folder.name}</span>
  </button>

  
<div className="folder-card-actions">
  <button
  type="button"
  className="folder-menu-button"
  data-folder-menu-trigger={folder.id}
    aria-label={`Actions for ${folder.name}`}
    title="Folder actions"
    onClick={(event) => {
  event.stopPropagation();

  if (openFolderMenu === folder.id) {
    setOpenFolderMenu(null);
    setFolderMenuPosition(null);
    return;
  }

  
const rect = event.currentTarget.getBoundingClientRect();
const menuWidth = 190;
const gap = 6;
const padding = 12;

const estimatedMenuHeight = Math.min(
  250,
  window.innerHeight - padding * 2
);

let left = rect.right - menuWidth;

left = Math.max(
  padding,
  Math.min(left, window.innerWidth - menuWidth - padding)
);

const spaceBelow = window.innerHeight - rect.bottom - padding;
const spaceAbove = rect.top - padding;

const openUpward =
  spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

let top = openUpward
  ? rect.top - estimatedMenuHeight - gap
  : rect.bottom + gap;

top = Math.max(
  padding,
  Math.min(
    top,
    window.innerHeight - estimatedMenuHeight - padding
  )
);

setFolderMenuPosition({ top, left });
setOpenFolderMenu(folder.id);
}}
  >
    <MoreVertical size={18} />
  </button>

  
{openFolderMenu === folder.id &&
  folderMenuPosition &&
  createPortal(
    <div
      className="folder-actions-menu"
      style={{
        position: "fixed",
        top: `${folderMenuPosition.top}px`,
        left: `${folderMenuPosition.left}px`,
        right: "auto",
        bottom: "auto",
        transform: "none",
        zIndex: 9999,
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          setRenameFolderData(folder);
          setRenameFolderName(folder.name);
          setOpenFolderMenu(null);
          setFolderMenuPosition(null);
        }}
      >
        <Pencil size={16} />
        Rename
      </button>

      <button
  type="button"
  onClick={() => {
    setOpenFolderMenu(null);
    setFolderMenuPosition(null);
    setShareFolderData(folder);
  }}
>
  <Share2 size={16} />
  Share
</button>

      <button
        type="button"
        onClick={() => {
          setFolderDetailsData(folder);
          setOpenFolderMenu(null);
          setFolderMenuPosition(null);
        }}
      >
        <Info size={16} />
        Details
      </button>

      <button
  type="button"
  onClick={() => handleDownloadFolder(folder)}
>
  <Download size={16} />
  Download folder
</button>

      <button
        type="button"
        className="danger-action"
        onClick={() => {
          setOpenFolderMenu(null);
          setFolderMenuPosition(null);
          handleDeleteFolder(folder);
        }}
      >
        <Trash2 size={16} />
        Move to Trash
      </button>

    </div>,
    document.body
  )}

</div>

</div>
        ))}
    </div>
  </div>
)}

<div className="files-section">
  <div className="files-section-header">
    <h2>Files</h2>
  </div>

  {visibleFiles.length > 0 && (
  <div className="bulk-selection-toolbar">
    <label className="bulk-select-all">
      <input
        type="checkbox"
        checked={allVisibleSelected}
        onChange={toggleSelectAll}
        aria-label="Select all visible files"
      />

      <span>Select all</span>
    </label>

    {selectedFileIds.length > 0 && (
      <div className="bulk-selection-actions">
        <span className="bulk-selection-count">
          {selectedFileIds.length} selected
        </span>

        <button
  type="button"
  onClick={handleBulkCopyOpen}
  disabled={bulkActionLoading || movingFile || copyingToFolder}
  className="bulk-copy-button"
>
  <Copy size={16} />
  Copy
</button>

<button
  type="button"
  onClick={handleBulkMoveOpen}
  disabled={bulkActionLoading || movingFile || copyingToFolder}
  className="bulk-move-button"
>
  <Folder size={16} />
  Move
</button>

        <button
          type="button"
          onClick={handleBulkDelete}
          disabled={bulkActionLoading}
          className="bulk-delete-button"
        >
          <Trash2 size={16} />
          {bulkActionLoading ? "Deleting..." : "Delete"}
        </button>

        <button
          type="button"
          onClick={clearSelection}
          disabled={bulkActionLoading}
          className="bulk-clear-button"
          aria-label="Clear selection"
        >
          <X size={16} />
          Clear
        </button>
      </div>
    )}
  </div>
)}

        {visibleFiles.length === 0 ? (

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

  <label
  className="file-selection-checkbox"
  onClick={(event) => event.stopPropagation()}
>
  <input
    type="checkbox"
    checked={selectedFileIds.includes(file.id)}
    onChange={() => toggleFileSelection(file.id)}
    aria-label={`Select ${file.name}`}
  />
</label>
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
  onClick={(event) => {
    event.stopPropagation();
    handleMenuToggle(file, event);
  }}
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

  <label
  className="file-selection-checkbox"
  onClick={(event) => event.stopPropagation()}
>
  <input
    type="checkbox"
    checked={selectedFileIds.includes(file.id)}
    onChange={() => toggleFileSelection(file.id)}
    aria-label={`Select ${file.name}`}
  />
</label>
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
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDownload(file);
                    }}
                  >
                    <Download size={16} />
                    Download
                  </button>

<button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
    handleMakeCopy(file);
  }}
>
  <Copy size={16} />
  Make a copy
</button>

                  <button
  onClick={(event) => {
    event.stopPropagation();
    handleShare(file);
  }}
>
  <Share2 size={16} />
  Share
</button>

<button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
    handleToggleFavorite(file);
  }}
>
  <Star
    size={16}
    fill={file.is_favorite ? "currentColor" : "none"}
  />
  {file.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
</button>

<button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
    handleRenameOpen(file);
  }}
>
  <Pencil size={16} />
  Rename
</button>


<button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
    handleMoveOpen(file);
  }}
>
  <Folder size={16} />
  Move to folder
</button>

<button
  type="button"
  onClick={(event) => {
    event.stopPropagation();
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
                    className="danger-action"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(file);
                    }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        
{openMenu && menuPosition && createPortal(
  <>
    {window.innerWidth <= 768 && (
      <div
        className="file-menu-backdrop"
        onClick={() => {
          setOpenMenu(null);
          setMenuPosition(null);
          activeButtonRef.current = null;
        }}
      />
    )}

    
<div
  ref={menuRef}
  className="file-menu file-menu-floating"
  style={{
    position: "fixed",
    top: `${menuPosition.top}px`,
    left: `${menuPosition.left}px`,
    maxHeight: menuPosition.maxHeight
      ? `${menuPosition.maxHeight}px`
      : undefined,
    zIndex: 9999,
  }}
  onTouchStart={(event) => {
    menuRef.current.dataset.touchStartY =
      event.touches[0].clientY;
  }}
  onTouchEnd={(event) => {
    const startY = Number(
      menuRef.current.dataset.touchStartY
    );
    const endY = event.changedTouches[0].clientY;

    if (endY - startY > 90) {
      setOpenMenu(null);
      setMenuPosition(null);
      activeButtonRef.current = null;
    }
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
                      handleDownload(file)
                    }
                  >
                    <Download size={16} />
                    Download
                  </button>

                  
<button
  type="button"
  disabled={copyingFile !== null}
  onClick={() => handleMakeCopy(file)}
>
  <Copy size={16} />
  {copyingFile === file.id ? "Making copy..." : "Make a copy"}
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
  onClick={() => handleToggleFavorite(file)}
>
  <Star
    size={16}
    fill={file.is_favorite ? "currentColor" : "none"}
  />
  {file.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
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
        </>,
        document.body
      )}
      </section>

      {shareFileData && (
  <ShareFileModal
    file={shareFileData}
    onClose={closeShare}
    onShared={async () => {
  await loadFilesAndFolders();
}}
  />
)}


{shareFolderData && (
  <ShareFolderModal
    folder={shareFolderData}
    onClose={() => setShareFolderData(null)}
    onShared={loadFilesAndFolders}
  />
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
    className="folder-copy-overlay"
    onClick={() => {
      if (!movingFile) setMoveFileData(null);
    }}
  >
    <div
      className="folder-copy-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-folder-modal-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="folder-copy-modal-header">
        <div>
          <h2 id="move-folder-modal-title">Move files</h2>
          <p>
            {bulkMoveMode
              ? `Choose a destination for ${selectedFiles.length} selected files.`
              : `Choose where to move "${moveFileData.name}".`}
          </p>
        </div>

        <button
          type="button"
          className="folder-copy-close"
          onClick={() => setMoveFileData(null)}
          disabled={movingFile}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      <div className="folder-copy-destinations">
        <label
          className="folder-copy-option"
          data-selected={fileMoveDestination === ""}
        >
          <input
            type="radio"
            name="file-move-destination"
            checked={fileMoveDestination === ""}
            onChange={() => setFileMoveDestination("")}
          />
          <Folder size={19} />
          <span>
            <strong>My Files</strong>
            <small>Root directory</small>
          </span>
        </label>

        {folders.map((folder) => (
          <label
            key={folder.id}
            className="folder-copy-option"
            data-selected={fileMoveDestination === folder.id}
          >
            <input
              type="radio"
              name="file-move-destination"
              checked={fileMoveDestination === folder.id}
              onChange={() => setFileMoveDestination(folder.id)}
            />
            <Folder size={19} />
            <span>
              <strong>{folder.name}</strong>
              <small>
  {folder.id === moveFileData.folder_id
    ? `Current location · ${getFolderDisplayPath(folder)}`
    : getFolderDisplayPath(folder)}
</small>
            </span>
          </label>
        ))}
      </div>

      <div className="folder-copy-modal-actions">
        <button
          type="button"
          className="bulk-clear-button"
          onClick={() => setMoveFileData(null)}
          disabled={movingFile}
        >
          Cancel
        </button>

        <button
          type="button"
          className="bulk-move-button"
          onClick={() => handleMove(fileMoveDestination || null)}
          disabled={
            movingFile ||
            fileMoveDestination === (moveFileData.folder_id ?? "")
          }
        >
          <Folder size={16} />
          {movingFile ? "Moving..." : "Move here"}
        </button>
      </div>
    </div>
  </div>
)}




{copyFileData && (
  <div
    className="folder-copy-overlay"
    onClick={() => {
      if (!copyingToFolder) setCopyFileData(null);
    }}
  >
    <div
      className="folder-copy-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-folder-modal-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="folder-copy-modal-header">
        <div>
          <h2 id="copy-folder-modal-title">Copy files</h2>
          <p>
            {bulkCopyMode
              ? `Choose a destination for copies of ${selectedFiles.length} selected files.`
              : `Choose where to save the copy of "${copyFileData.name}".`}
          </p>
        </div>

        <button
          type="button"
          className="folder-copy-close"
          onClick={() => setCopyFileData(null)}
          disabled={copyingToFolder}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      <div className="folder-copy-destinations">
        <label
          className="folder-copy-option"
          data-selected={fileCopyDestination === ""}
        >
          <input
            type="radio"
            name="file-copy-destination"
            checked={fileCopyDestination === ""}
            onChange={() => setFileCopyDestination("")}
          />
          <Folder size={19} />
          <span>
            <strong>My Files</strong>
            <small>Root directory</small>
          </span>
        </label>

        {folders.map((folder) => (
          <label
            key={folder.id}
            className="folder-copy-option"
            data-selected={fileCopyDestination === folder.id}
          >
            <input
              type="radio"
              name="file-copy-destination"
              checked={fileCopyDestination === folder.id}
              onChange={() => setFileCopyDestination(folder.id)}
            />
            <Folder size={19} />
            <span>
              <strong>{folder.name}</strong>
              <small>
  {folder.id === copyFileData.folder_id
    ? `Copy alongside original · ${getFolderDisplayPath(folder)}`
    : getFolderDisplayPath(folder)}
</small>
            </span>
          </label>
        ))}
      </div>

      <div className="folder-copy-modal-actions">
        <button
          type="button"
          className="bulk-clear-button"
          onClick={() => setCopyFileData(null)}
          disabled={copyingToFolder}
        >
          Cancel
        </button>

        <button
          type="button"
          className="bulk-copy-button"
          onClick={() =>
            handleCopyToFolder(fileCopyDestination || null)
          }
          disabled={copyingToFolder}
        >
          <Copy size={16} />
          {copyingToFolder ? "Copying..." : "Copy here"}
        </button>
      </div>
    </div>
  </div>
)}



{renameFileData && (
  <div
    className="folder-modal-overlay"
    onMouseDown={(event) => {
      if (
        event.target === event.currentTarget &&
        !renamingFile
      ) {
        setRenameFileData(null);
        setRenameFileName("");
      }
    }}
  >
    <div
      className="folder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-file-modal-title"
    >
      <div className="folder-modal-header">
        <div>
          <p className="folder-modal-eyebrow">
            RENAME FILE
          </p>

          <h2 id="rename-file-modal-title">
            Rename file
          </h2>

          <p className="folder-modal-subtitle">
            Give your file a new name.
          </p>
        </div>

        <button
          type="button"
          className="folder-modal-close"
          onClick={() => {
            setRenameFileData(null);
            setRenameFileName("");
          }}
          disabled={renamingFile}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleRename}>
        <label htmlFor="rename-file-name">
          File name
        </label>

        <div className="rename-file-input-row">
  <input
    id="rename-file-name"
    type="text"
    value={renameFileName}
    onChange={(event) =>
      setRenameFileName(event.target.value)
    }
    autoFocus
    maxLength={255}
    required
  />

  {renameFileExtension && (
    <span className="rename-file-extension">
      {renameFileExtension}
    </span>
  )}
</div>

        <div className="folder-modal-actions">
          <button
            type="button"
            className="folder-cancel-button"
            onClick={() => {
              setRenameFileData(null);
              setRenameFileName("");
            }}
            disabled={renamingFile}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="folder-create-button"
            disabled={
              renamingFile || !renameFileName.trim()
            }
          >
            {renamingFile ? "Renaming..." : "Rename"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

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
        onClose={closePreview}
        onDownload={() =>
          handleDownload(previewFile)
        }
      />
    )}
  </>
)}

{renameFolderData && (
  <div
    className="folder-modal-overlay"
    onMouseDown={(event) => {
      if (
        event.target === event.currentTarget &&
        !renamingFolder
      ) {
        setRenameFolderData(null);
        setRenameFolderName("");
      }
    }}
  >
    <div
      className="folder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-folder-modal-title"
    >
      <div className="folder-modal-header">
        <div>
          <p className="folder-modal-eyebrow">
            RENAME FOLDER
          </p>

          <h2 id="rename-folder-modal-title">
            Rename folder
          </h2>

          <p className="folder-modal-subtitle">
            Give your folder a new name.
          </p>
        </div>

        <button
          type="button"
          className="folder-modal-close"
          onClick={() => {
            setRenameFolderData(null);
            setRenameFolderName("");
          }}
          disabled={renamingFolder}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleRenameFolder}>
        <label htmlFor="rename-folder-name">
          Folder name
        </label>

        <input
          id="rename-folder-name"
          type="text"
          value={renameFolderName}
          onChange={(event) =>
            setRenameFolderName(event.target.value)
          }
          autoFocus
          maxLength={80}
          required
        />

        <div className="folder-modal-actions">
          <button
            type="button"
            className="folder-cancel-button"
            onClick={() => {
              setRenameFolderData(null);
              setRenameFolderName("");
            }}
            disabled={renamingFolder}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="folder-create-button"
            disabled={
              renamingFolder || !renameFolderName.trim()
            }
          >
            {renamingFolder ? "Renaming..." : "Rename"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{detailsFile && (
  <FileDetailsModal
    file={detailsFile}
    folderName={
      folders.find(
        (folder) => folder.id === detailsFile.folder_id
      )?.name || "My Files"
    }
    onClose={() => setDetailsFile(null)}
  />
)}


{showCopyFoldersModal && (
  <div
    className="folder-copy-overlay"
    onClick={() => setShowCopyFoldersModal(false)}
  >
    <div
      className="folder-copy-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-copy-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="folder-copy-modal-header">
        <div>
          <h2 id="folder-copy-title">Copy folders</h2>
          <p>Choose where you want the copies to go.</p>
        </div>

        <button
          type="button"
          className="folder-copy-close"
          onClick={() => setShowCopyFoldersModal(false)}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      <label
        className="folder-copy-option"
        data-selected={folderCopyDestination === ""}
      >
        <input
          type="radio"
          name="folder-copy-destination"
          value=""
          checked={folderCopyDestination === ""}
          onChange={() => setFolderCopyDestination("")}
        />
        <Folder size={19} />
        <span>
          <strong>My Files</strong>
          <small>Root directory</small>
        </span>
      </label>

      <div className="folder-copy-destinations">
        {folders
          .filter((folder) => {
            const excludedIds = new Set(selectedFolderIds);

            let changed = true;

            while (changed) {
              changed = false;

              folders.forEach((item) => {
                if (
                  excludedIds.has(item.parent_id) &&
                  !excludedIds.has(item.id)
                ) {
                  excludedIds.add(item.id);
                  changed = true;
                }
              });
            }

            return !excludedIds.has(folder.id);
          })
          .map((folder) => (
            <label
              key={folder.id}
              className="folder-copy-option"
              data-selected={folderCopyDestination === folder.id}
            >
              <input
                type="radio"
                name="folder-copy-destination"
                value={folder.id}
                checked={folderCopyDestination === folder.id}
                onChange={() =>
                  setFolderCopyDestination(folder.id)
                }
              />
              <Folder size={19} />
              <span>
                <strong>{folder.name}</strong>
<small className="folder-destination-path">
  {getFolderDisplayPath(folder)}
</small>
              </span>
            </label>
          ))}
      </div>

      <div className="folder-copy-modal-actions">
        <button
          type="button"
          className="bulk-clear-button"
          onClick={() => setShowCopyFoldersModal(false)}
          disabled={bulkActionLoading}
        >
          Cancel
        </button>

        <button
          type="button"
          className="bulk-copy-button"
          onClick={handleConfirmBulkCopyFolders}
          disabled={bulkActionLoading}
        >
          <Copy size={16} />
          {bulkActionLoading ? "Copying..." : "Copy here"}
        </button>
      </div>
    </div>
  </div>
)}


{showMoveFoldersModal && (
  <div
    className="folder-copy-overlay"
    onClick={() => {
      if (!bulkActionLoading) setShowMoveFoldersModal(false);
    }}
  >
    <div
      className="folder-copy-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-move-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="folder-copy-modal-header">
        <div>
          <h2 id="folder-move-title">Move folders</h2>
          <p>Choose the destination for your selected folders.</p>
        </div>

        <button
          type="button"
          className="folder-copy-close"
          onClick={() => setShowMoveFoldersModal(false)}
          disabled={bulkActionLoading}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      <label
        className="folder-copy-option"
        data-selected={folderMoveDestination === ""}
      >
        <input
          type="radio"
          name="folder-move-destination"
          checked={folderMoveDestination === ""}
          onChange={() => setFolderMoveDestination("")}
        />
        <Folder size={19} />
        <span>
          <strong>My Files</strong>
          <small>Root directory</small>
        </span>
      </label>

      <div className="folder-copy-destinations">
        {folders
          .filter((folder) => {
            const excludedIds = new Set(selectedFolderIds);
            let changed = true;

            while (changed) {
              changed = false;

              folders.forEach((item) => {
                if (
                  excludedIds.has(item.parent_id) &&
                  !excludedIds.has(item.id)
                ) {
                  excludedIds.add(item.id);
                  changed = true;
                }
              });
            }

            return !excludedIds.has(folder.id);
          })
          .map((folder) => (
            <label
              key={folder.id}
              className="folder-copy-option"
              data-selected={folderMoveDestination === folder.id}
            >
              <input
                type="radio"
                name="folder-move-destination"
                checked={folderMoveDestination === folder.id}
                onChange={() => setFolderMoveDestination(folder.id)}
              />
              <Folder size={19} />
              <span>
                <strong>{folder.name}</strong>
<small className="folder-destination-path">
  {getFolderDisplayPath(folder)}
</small>
              </span>
            </label>
          ))}
      </div>

      <div className="folder-copy-modal-actions">
        <button
          type="button"
          className="bulk-clear-button"
          onClick={() => setShowMoveFoldersModal(false)}
          disabled={bulkActionLoading}
        >
          Cancel
        </button>

        <button
          type="button"
          className="bulk-move-button"
          onClick={handleConfirmBulkMoveFolders}
          disabled={bulkActionLoading}
        >
          <Folder size={16} />
          {bulkActionLoading ? "Moving..." : "Move here"}
        </button>
      </div>
    </div>
  </div>
)}

{folderDetailsData && (
  <div
    className="folder-modal-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setFolderDetailsData(null);
      }
    }}
  >
    <div
      className="folder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-details-title"
    >
      <div className="folder-modal-header">
        <div>
          <p className="folder-modal-eyebrow">
            FOLDER INFORMATION
          </p>

          <h2 id="folder-details-title">
            Folder details
          </h2>
        </div>

        <button
          type="button"
          className="folder-modal-close"
          onClick={() => setFolderDetailsData(null)}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="folder-details-content">
        <div className="folder-details-icon">
          <Folder size={30} />
        </div>

        <h3>{folderDetailsData.name}</h3>

        <div className="folder-details-row">
          <span>Location</span>
          <strong>
            {folderDetailsData.parent_id
              ? getFolderDisplayPath(
                  folderDetailsData
                )
              : "My Files"}
          </strong>
        </div>

        <div className="folder-details-row">
          <span>Created</span>
          <strong>
            {folderDetailsData.created_at
              ? formatDate(folderDetailsData.created_at)
              : "Not available"}
          </strong>
        </div>

        <div className="folder-details-row">
          <span>Files inside</span>
          <strong>
            {files.filter(
              (file) =>
                file.folder_id === folderDetailsData.id
            ).length}
          </strong>
        </div>

        <div className="folder-details-row">
          <span>Subfolders</span>
          <strong>
            {folders.filter(
              (folder) =>
                folder.parent_id === folderDetailsData.id
            ).length}
          </strong>
        </div>
      </div>

      <div className="folder-modal-actions">
        <button
          type="button"
          className="folder-create-button"
          onClick={() => setFolderDetailsData(null)}
        >
          Done
        </button>
      </div>
    </div>
  </div>
)}


{folderDownloadProgress && (
  <div className="folder-modal-overlay">
    <div
  className="folder-modal folder-download-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-download-title"
    >
      <h2 id="folder-download-title">
        {folderDownloadProgress.stage === "complete"
          ? "Download ready"
          : folderDownloadProgress.stage === "error"
            ? "Download failed"
            : folderDownloadProgress.stage === "zipping"
              ? "Preparing ZIP file"
              : "Downloading folder"}
      </h2>

      <p>
        {folderDownloadProgress.folderName}
      </p>

      {folderDownloadProgress.stage !== "error" && (
        <>
          <div className="folder-download-progress-track">
            <div
              className="folder-download-progress-fill"
              style={{
                width: `${folderDownloadProgress.percent}%`,
              }}
            />
          </div>

          <p className="folder-download-progress-text">
            {folderDownloadProgress.stage === "complete"
              ? "ZIP file created."
              : folderDownloadProgress.stage === "zipping"
                ? "Compressing files..."
                : folderDownloadProgress.totalFiles === 0
                  ? "Preparing empty folder..."
                  : `Processing ${folderDownloadProgress.completedFiles} of ${folderDownloadProgress.totalFiles} files`}
          </p>

          <p className="folder-download-progress-percent">
            {folderDownloadProgress.percent}%
          </p>
        </>
      )}

      {folderDownloadProgress.failedFiles.length > 0 && (
        <div className="folder-download-failures">
          <p>
            {folderDownloadProgress.failedFiles.length} file(s) could not
            be downloaded:
          </p>

          <ul>
            {folderDownloadProgress.failedFiles.map((fileName, index) => (
              <li key={`${fileName}-${index}`}>{fileName}</li>
            ))}
          </ul>

          <p>
            The ZIP was created, but the listed files are missing.
          </p>
        </div>
      )}

      {folderDownloadProgress.message && (
        <p role="alert">{folderDownloadProgress.message}</p>
      )}

      {(folderDownloadProgress.stage === "complete" ||
        folderDownloadProgress.stage === "error") && (
        <button
          type="button"
          className="modal-button"
          onClick={() => setFolderDownloadProgress(null)}
        >
          Close
        </button>
      )}
    </div>
  </div>
)}


    </main>
  );
}

export default Files;