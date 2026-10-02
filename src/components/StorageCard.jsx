function StorageCard({ icon, value, label }) {
  return (
    <div className="storage-card">
      <div className="storage-card-icon">
        {icon}
      </div>

      <div>
        <strong className="storage-card-value">
          {value}
        </strong>

        <p className="storage-card-label">
          {label}
        </p>
      </div>
    </div>
  );
}

export default StorageCard;