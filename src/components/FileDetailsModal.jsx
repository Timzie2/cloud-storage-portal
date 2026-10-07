import {
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Folder,
  Calendar,
  HardDrive,
  FileType,
  X,
} from "lucide-react";

function getFileIcon(mimeType = "") {
  if (mimeType.startsWith("image/")) {
    return Image;
  }

  if (mimeType.startsWith("video/")) {
    return Video;
  }

  if (mimeType.startsWith("audio/")) {
    return Music;
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z") ||
    mimeType.includes("tar")
  ) {
    return Archive;
  }

  if (
    mimeType.includes("pdf") ||
    mimeType.includes("text") ||
    mimeType.includes("document") ||
    mimeType.includes("word")
  ) {
    return FileText;
  }

  return File;
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 Bytes";
  }

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  return new Date(date).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getFileType(file) {
  if (file?.mime_type) {
    return file.mime_type;
  }

  const extension = file?.name?.includes(".")
    ? file.name.split(".").pop().toUpperCase()
    : "Unknown";

  return extension;
}

function FileDetailsModal({ file, folderName = "My Files", onClose }) {
  if (!file) {
    return null;
  }

  const Icon = getFileIcon(file.mime_type);

  return (
    <div
      className="file-details-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="file-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-details-modal-title"
      >
        <div className="file-details-modal-header">
          <div>
            <p className="file-details-modal-eyebrow">
              FILE DETAILS
            </p>

            <h2 id="file-details-modal-title">
              File information
            </h2>
          </div>

          <button
            type="button"
            className="file-details-modal-close"
            onClick={onClose}
            aria-label="Close file details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="file-details-main">
          <div className="file-details-icon">
            <Icon size={28} />
          </div>

          <div className="file-details-name">
            <strong title={file.name}>{file.name}</strong>
            <span>{getFileType(file)}</span>
          </div>
        </div>

        <div className="file-details-divider" />

        <div className="file-details-grid">
          <div className="file-detail-item">
            <div className="file-detail-label">
              <HardDrive size={15} />
              <span>Size</span>
            </div>

            <strong>{formatFileSize(file.size_bytes)}</strong>
          </div>

          <div className="file-detail-item">
            <div className="file-detail-label">
              <FileType size={15} />
              <span>Type</span>
            </div>

            <strong>{getFileType(file)}</strong>
          </div>

          <div className="file-detail-item">
            <div className="file-detail-label">
              <Folder size={15} />
              <span>Location</span>
            </div>

            <strong title={folderName}>{folderName}</strong>
          </div>

          <div className="file-detail-item">
            <div className="file-detail-label">
              <Calendar size={15} />
              <span>Uploaded</span>
            </div>

            <strong>{formatDate(file.created_at)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileDetailsModal;