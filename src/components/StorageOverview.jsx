import { Folder, HardDrive, Database, Share2 } from "lucide-react";

function formatStorage(bytes) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function getStorageLevel(percentage) {
  if (percentage >= 95) return "critical";
  if (percentage >= 80) return "warning";
  if (percentage >= 60) return "elevated";

  return "healthy";
}

function StorageRing({ percentage }) {
  const safePercentage = Math.min(Math.max(percentage, 0), 100);
  const level = getStorageLevel(safePercentage);

  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (safePercentage / 100) * circumference;

  return (
    <div className={`storage-ring ${level}`}>
      <svg
        className="storage-ring-svg"
        viewBox="0 0 40 40"
        aria-hidden="true"
      >
        <circle
          className="storage-ring-track"
          cx="20"
          cy="20"
          r={radius}
        />

        <circle
          className="storage-ring-progress"
          cx="20"
          cy="20"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      <span className="storage-ring-value">
        {Math.round(safePercentage)}%
      </span>
    </div>
  );
}

function StorageOverview({
  files = [],
  sharedCount = 0,
  storageQuota = null,
}) {
  const totalFiles = files.length;

  const storageUsed =
    storageQuota?.storageUsed ??
    files.reduce(
      (total, file) => total + Number(file.size_bytes || 0),
      0
    );

  const storageLimit = storageQuota?.storageLimit ?? 0;

  const usagePercentage =
    storageLimit > 0
      ? Math.min((storageUsed / storageLimit) * 100, 100)
      : 0;

  return (
    <div className="storage-overview">

      {/* TOTAL FILES */}
      <div className="storage-card">
        <div className="storage-card-icon">
          <Folder size={20} />
        </div>

        <div>
          <span className="storage-card-value">
            {totalFiles}
          </span>

          <span className="storage-card-label">
            Total Files
          </span>
        </div>
      </div>


      {/* STORAGE USED */}
      <div className="storage-card storage-used-card">
        <StorageRing percentage={usagePercentage} />

        <div>
          <span className="storage-card-value">
            {formatStorage(storageUsed)}
          </span>

          <span className="storage-card-label">
            Storage Used
          </span>
        </div>
      </div>


      {/* TOTAL STORAGE */}
      <div className="storage-card">
        <div className="storage-card-icon">
          <Database size={20} />
        </div>

        <div>
          <span className="storage-card-value">
            {formatStorage(storageLimit)}
          </span>

          <span className="storage-card-label">
            Total Storage
          </span>
        </div>
      </div>


      {/* SHARED FILES */}
      <div className="storage-card">
        <div className="storage-card-icon">
          <Share2 size={20} />
        </div>

        <div>
          <span className="storage-card-value">
            {sharedCount}
          </span>

          <span className="storage-card-label">
            Shared Files
          </span>
        </div>
      </div>

    </div>
  );
}

export default StorageOverview;