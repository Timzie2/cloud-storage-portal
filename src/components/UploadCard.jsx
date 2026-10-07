import { useEffect, useRef, useState } from "react";

import {
  UploadCloud,
  Loader2,
  X,
  FileText,
  File,
  Image as ImageIcon,
  Film,
  Music,
  Upload,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { uploadFile } from "../services/storage";
import { createNotification } from "../services/notifications";
import { getStorageQuota } from "../services/storageQuota";

function UploadCard({ onUploadComplete, folderId = null, uploadTriggerRef }) {
  const { user } = useAuth();

  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const [previewUrls, setPreviewUrls] = useState({});
  const [isDragging, setIsDragging] = useState(false);

  const formatStorage = (bytes) => {
    if (!bytes || bytes <= 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];

    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(
      index === 0 ? 0 : 1
    )} ${units[index]}`;
  };

  const getFileType = (file) => {
    if (!file) return "file";

    if (file.type.startsWith("image/")) {
      return "image";
    }

    if (file.type.startsWith("video/")) {
      return "video";
    }

    if (file.type.startsWith("audio/")) {
      return "audio";
    }

    if (file.type === "application/pdf") {
      return "pdf";
    }

    return "document";
  };

  const getFileIcon = (file, size = 42) => {
    const type = getFileType(file);

    if (type === "image") {
      return <ImageIcon size={size} />;
    }

    if (type === "video") {
      return <Film size={size} />;
    }

    if (type === "audio") {
      return <Music size={size} />;
    }

    if (type === "pdf" || type === "document") {
      return <FileText size={size} />;
    }

    return <File size={size} />;
  };

  const createPreviewUrls = (files) => {
    const urls = {};

    files.forEach((file, index) => {
      const type = getFileType(file);

      if (
        type === "image" ||
        type === "video" ||
        type === "audio" ||
        type === "pdf"
      ) {
        urls[index] = URL.createObjectURL(file);
      }
    });

    return urls;
  };

  const addFiles = (files) => {
    if (!user || files.length === 0) return;

    setMessage("");

    const incomingFiles = Array.from(files);

    setSelectedFiles((currentFiles) => {
      const existingKeys = new Set(
        currentFiles.map(
          (file) =>
            `${file.name}-${file.size}-${file.lastModified}`
        )
      );

      const newFiles = incomingFiles.filter((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;

        return !existingKeys.has(key);
      });

      return [...currentFiles, ...newFiles];
    });
  };

  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviewUrls({});
      setActiveFileIndex(0);
      return;
    }

    const urls = createPreviewUrls(selectedFiles);

    setPreviewUrls(urls);

    return () => {
      Object.values(urls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [selectedFiles]);

  const handleFileSelect = (event) => {
    const files = event.target.files;

    if (!files || files.length === 0) return;

    addFiles(files);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget === event.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    if (uploading) return;

    const files = event.dataTransfer.files;

    if (!files || files.length === 0) return;

    addFiles(files);
  };

  const removeFile = (indexToRemove) => {
    if (uploading) return;

    setSelectedFiles((currentFiles) =>
      currentFiles.filter(
        (_, index) => index !== indexToRemove
      )
    );

    setActiveFileIndex((currentIndex) => {
      if (indexToRemove < currentIndex) {
        return currentIndex - 1;
      }

      if (indexToRemove === currentIndex) {
        return Math.max(0, currentIndex - 1);
      }

      return currentIndex;
    });
  };

  const closePreview = () => {
    if (uploading) return;

    setSelectedFiles([]);
    setPreviewUrls({});
    setActiveFileIndex(0);
    setMessage("");
    setIsDragging(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user) return;

    setUploading(true);
    setMessage("");

    try {
      const quota = await getStorageQuota(user.id);

      const totalUploadSize = selectedFiles.reduce(
        (total, file) => total + file.size,
        0
      );

      const remainingStorage =
        quota.storageLimit - quota.storageUsed;

      if (remainingStorage <= 0) {
        setMessage(
          "Storage limit reached. Free up some space before uploading."
        );
        return;
      }

      if (totalUploadSize > remainingStorage) {
        setMessage(
          `Not enough storage. You need ${formatStorage(
            totalUploadSize
          )}, but only ${formatStorage(
            remainingStorage
          )} is available.`
        );
        return;
      }

      const previousPercentage =
        quota.storageLimit > 0
          ? (quota.storageUsed / quota.storageLimit) * 100
          : 0;

      const uploadedFiles = [];

      for (const file of selectedFiles) {
        const uploadedFile = await uploadFile(
          file,
          user.id,
          folderId
        );

        uploadedFiles.push(uploadedFile);

        try {
          await createNotification({
            userId: user.id,
            type: "file_uploaded",
            title: "File uploaded",
            message: `"${uploadedFile.name}" was uploaded successfully.`,
            relatedFileId: uploadedFile.id,
          });
        } catch (notificationError) {
          console.error(
            "Could not create upload notification:",
            notificationError
          );
        }
      }

      const updatedQuota = await getStorageQuota(user.id);

      const currentPercentage =
        updatedQuota.storageLimit > 0
          ? (updatedQuota.storageUsed /
              updatedQuota.storageLimit) *
            100
          : 0;

      try {
        if (
          previousPercentage < 80 &&
          currentPercentage >= 80
        ) {
          await createNotification({
            userId: user.id,
            type: "storage_warning",
            title: "Storage almost full",
            message: `You've used ${Math.round(
              currentPercentage
            )}% of your storage. Consider freeing up some space.`,
            relatedFileId: null,
          });
        }

        if (
          previousPercentage < 100 &&
          currentPercentage >= 100
        ) {
          await createNotification({
            userId: user.id,
            type: "storage_full",
            title: "Storage limit reached",
            message:
              "Your storage is full. Delete some files before uploading more.",
            relatedFileId: null,
          });
        }
      } catch (notificationError) {
        console.error(
          "Could not create storage notification:",
          notificationError
        );
      }

      setMessage(
        `${uploadedFiles.length} ${
          uploadedFiles.length === 1
            ? "file"
            : "files"
        } uploaded successfully.`
      );

      onUploadComplete?.(uploadedFiles);

      setSelectedFiles([]);
      setPreviewUrls({});
      setActiveFileIndex(0);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      setMessage(
        "Some files could not be uploaded. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const activeFile =
    selectedFiles[activeFileIndex] ?? null;

  const activePreviewUrl =
    previewUrls[activeFileIndex] ?? "";

  const renderPreview = () => {
    if (!activeFile) return null;

    const type = getFileType(activeFile);

    if (type === "image" && activePreviewUrl) {
      return (
        <img
          src={activePreviewUrl}
          alt={activeFile.name}
          className="upload-preview-media"
        />
      );
    }

    if (type === "video" && activePreviewUrl) {
      return (
        <video
          src={activePreviewUrl}
          className="upload-preview-media"
          controls
          playsInline
        />
      );
    }

    if (type === "audio" && activePreviewUrl) {
      return (
        <div className="upload-preview-audio">
          <Music size={48} />

          <audio
            src={activePreviewUrl}
            controls
          />
        </div>
      );
    }

    if (type === "pdf" && activePreviewUrl) {
      return (
        <iframe
          src={activePreviewUrl}
          title={activeFile.name}
          className="upload-preview-pdf"
        />
      );
    }

    return (
      <div className="upload-preview-file">
        <div className="upload-preview-file-icon">
          {getFileIcon(activeFile)}
        </div>

        <strong>{activeFile.name}</strong>

        <span>
          {activeFile.type || "File"}
        </span>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        className={`upload-card ${
          isDragging ? "dragging" : ""
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={uploading}
      >
        <div className="upload-icon">
          {uploading ? (
            <Loader2
              size={24}
              className="upload-spinner"
            />
          ) : (
            <UploadCloud size={24} />
          )}
        </div>

        <div>
          <strong>
            {uploading
              ? "Uploading..."
              : isDragging
              ? "Drop files here"
              : "Upload files"}
          </strong>

          <p>
            {uploading
              ? "Please wait while your files are uploaded"
              : isDragging
              ? "Release to add files to your upload queue"
              : "Drag & drop files here or click to browse"}
          </p>
        </div>
      </button>

      <input
  ref={(element) => {
    fileInputRef.current = element;

    if (uploadTriggerRef) {
      uploadTriggerRef.current = element;
    }
  }}
  type="file"
  onChange={handleFileSelect}
  hidden
/>

      {message && (
        <p className="upload-message">
          {message}
        </p>
      )}

      {selectedFiles.length > 0 && (
        <div
          className="upload-preview-overlay"
          onClick={(event) => {
            if (
              event.target === event.currentTarget &&
              !uploading
            ) {
              closePreview();
            }
          }}
        >
          <div className="upload-preview-modal upload-queue-modal">
            <div className="upload-preview-header">
              <div>
                <span className="upload-preview-eyebrow">
                  Upload queue
                </span>

                <h3>
                  {selectedFiles.length}{" "}
                  {selectedFiles.length === 1
                    ? "file"
                    : "files"}{" "}
                  selected
                </h3>
              </div>

              <button
                type="button"
                className="upload-preview-close"
                onClick={closePreview}
                disabled={uploading}
                aria-label="Close upload queue"
              >
                <X size={20} />
              </button>
            </div>

            <div className="upload-queue-layout">
              <div className="upload-queue-list">
                {selectedFiles.map((file, index) => (
                  <button
                    type="button"
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className={`upload-queue-item ${
                      index === activeFileIndex
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveFileIndex(index)
                    }
                    disabled={uploading}
                  >
                    <span className="upload-queue-item-icon">
                      {getFileIcon(file, 20)}
                    </span>

                    <span className="upload-queue-item-info">
                      <strong title={file.name}>
                        {file.name}
                      </strong>

                      <small>
                        {formatStorage(file.size)}
                      </small>
                    </span>

                    <span
                      className="upload-queue-item-remove"
                      role="button"
                      tabIndex={uploading ? -1 : 0}
                      aria-label={`Remove ${file.name}`}
                      onClick={(event) => {
                        event.stopPropagation();

                        if (!uploading) {
                          removeFile(index);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          !uploading &&
                          (event.key === "Enter" ||
                            event.key === " ")
                        ) {
                          event.preventDefault();
                          event.stopPropagation();
                          removeFile(index);
                        }
                      }}
                    >
                      <X size={15} />
                    </span>
                  </button>
                ))}
              </div>

              <div className="upload-queue-preview">
                {renderPreview()}
              </div>
            </div>

            <div className="upload-preview-details">
              <div>
                <span>Selected</span>
                <strong>
                  {selectedFiles.length}{" "}
                  {selectedFiles.length === 1
                    ? "file"
                    : "files"}
                </strong>
              </div>

              <div>
                <span>Total size</span>
                <strong>
                  {formatStorage(
                    selectedFiles.reduce(
                      (total, file) =>
                        total + file.size,
                      0
                    )
                  )}
                </strong>
              </div>
            </div>

            <div className="upload-preview-actions">
              <button
                type="button"
                className="upload-preview-cancel"
                onClick={closePreview}
                disabled={uploading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="upload-preview-confirm"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2
                      size={17}
                      className="upload-spinner"
                    />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={17} />
                    Upload{" "}
                    {selectedFiles.length}{" "}
                    {selectedFiles.length === 1
                      ? "file"
                      : "files"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UploadCard;