import { useEffect } from "react";
import {
  X,
  Download,
  File,
  FileText,
  Image,
  Video,
  Music,
  Archive,
} from "lucide-react";

function getFileType(mimeType) {
  if (!mimeType) return "file";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text")
  ) {
    return "document";
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed")
  ) {
    return "archive";
  }

  return "file";
}

function getPreviewIcon(type) {
  switch (type) {
    case "image":
      return <Image size={32} />;

    case "video":
      return <Video size={32} />;

    case "audio":
      return <Music size={32} />;

    case "document":
      return <FileText size={32} />;

    case "archive":
      return <Archive size={32} />;

    default:
      return <File size={32} />;
  }
}

function FilePreviewModal({
  file,
  signedUrl,
  onClose,
  onDownload,
}) {
  useEffect(() => {
    if (!file) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow = "";
    };
  }, [file, onClose]);

  if (!file || !signedUrl) {
    return null;
  }

  const type = getFileType(file.mime_type);

  return (
    <div
      className="preview-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="preview-modal">
        <header className="preview-header">
          <div className="preview-file-info">
            <div className="preview-file-icon">
              {getPreviewIcon(type)}
            </div>

            <div>
              <strong>{file.name}</strong>

              <span>
                {file.mime_type || "Unknown file type"}
              </span>
            </div>
          </div>

          <div className="preview-actions">
            <button
              className="preview-download"
              onClick={() =>
                onDownload(file)
              }
              aria-label="Download file"
            >
              <Download size={18} />
              <span>Download</span>
            </button>

            <button
              className="preview-close"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="preview-content">
          {type === "image" && (
            <img
              src={signedUrl}
              alt={file.name}
              className="preview-image"
            />
          )}

          {type === "video" && (
            <video
              src={signedUrl}
              controls
              autoPlay
              className="preview-video"
            />
          )}

          {type === "audio" && (
            <div className="preview-audio">
              <div className="preview-large-icon">
                <Music size={42} />
              </div>

              <strong>{file.name}</strong>

              <audio
                src={signedUrl}
                controls
              />
            </div>
          )}

          {type === "document" &&
            file.mime_type?.includes("pdf") && (
              <iframe
                src={signedUrl}
                title={file.name}
                className="preview-pdf"
              />
            )}

          {type === "document" &&
            !file.mime_type?.includes("pdf") && (
              <div className="preview-unsupported">
                <FileText size={48} />

                <h3>
                  Preview unavailable
                </h3>

                <p>
                  This document type can't be
                  previewed in the browser.
                </p>

                <button
                  className="preview-download"
                  onClick={() =>
                    onDownload(file)
                  }
                >
                  <Download size={18} />
                  Download file
                </button>
              </div>
            )}

          {type === "archive" && (
            <div className="preview-unsupported">
              <Archive size={48} />

              <h3>Archive file</h3>

              <p>
                This file can't be previewed.
                Download it to open its contents.
              </p>

              <button
                className="preview-download"
                onClick={() =>
                  onDownload(file)
                }
              >
                <Download size={18} />
                Download file
              </button>
            </div>
          )}

          {type === "file" && (
            <div className="preview-unsupported">
              <File size={48} />

              <h3>Preview unavailable</h3>

              <p>
                This file type can't be previewed
                in the browser.
              </p>

              <button
                className="preview-download"
                onClick={() =>
                  onDownload(file)
                }
              >
                <Download size={18} />
                Download file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;