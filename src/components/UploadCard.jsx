import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { uploadFile } from "../services/storage";
import { createNotification } from "../services/notifications";
import { getStorageQuota } from "../services/storageQuota";

function UploadCard({ onUploadComplete }) {
  const { user } = useAuth();

  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

    const formatStorage = (bytes) => {
    if (!bytes || bytes <= 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.floor(
      Math.log(bytes) / Math.log(1024)
    );

    return `${(bytes / Math.pow(1024, index)).toFixed(
      index === 0 ? 0 : 1
    )} ${units[index]}`;
  };

    const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file || !user) return;

    setUploading(true);
    setMessage("");

    try {
      // Check current storage before uploading
      const quota = await getStorageQuota(user.id);

      const remainingStorage =
        quota.storageLimit - quota.storageUsed;

      if (remainingStorage <= 0) {
        setMessage(
          "Storage limit reached. Free up some space before uploading."
        );
        return;
      }

      if (file.size > remainingStorage) {
        setMessage(
          `Not enough storage. You have ${formatStorage(
            remainingStorage
          )} remaining.`
        );
        return;
      }

      const uploadedFile = await uploadFile(file, user.id);

// Check storage usage after upload
const updatedQuota = await getStorageQuota(user.id);

const previousPercentage =
  quota.storageLimit > 0
    ? (quota.storageUsed / quota.storageLimit) * 100
    : 0;

const currentPercentage =
  updatedQuota.storageLimit > 0
    ? (updatedQuota.storageUsed / updatedQuota.storageLimit) * 100
    : 0;

// Normal upload notification
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

// Storage warning notification
try {
  if (previousPercentage < 80 && currentPercentage >= 80) {
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

  if (previousPercentage < 100 && currentPercentage >= 100) {
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

setMessage("File uploaded successfully.");
onUploadComplete?.(uploadedFile);

    } catch (error) {
      console.error("Upload error:", error);
      setMessage("Upload failed. Please try again.");
    } finally {
      setUploading(false);

      // Allows selecting the same file again
      event.target.value = "";
    }
  };

  return (
    <>
      <button
        className="upload-card"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <div className="upload-icon">
          {uploading ? (
            <Loader2 size={24} className="upload-spinner" />
          ) : (
            <UploadCloud size={24} />
          )}
        </div>

        <div>
          <strong>
            {uploading ? "Uploading..." : "Upload files"}
          </strong>

          <p>
            {uploading
              ? "Please wait while your file is uploaded"
              : "Images, videos, documents and more"}
          </p>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleUpload}
        hidden
      />

      {message && (
        <p className="upload-message">
          {message}
        </p>
      )}
    </>
  );
}

export default UploadCard;