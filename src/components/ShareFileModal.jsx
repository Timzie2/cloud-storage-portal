
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  shareFile,
  getFileShares,
  revokeShare,
} from "../services/files";

function ShareFileModal({ file, onClose, onShared }) {
  const { user } = useAuth();

  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [revokingId, setRevokingId] = useState(null);

  const [permissions, setPermissions] = useState({
    can_edit: false,
    can_download: true,
    can_copy: true,
  });

  const handlePermissionChange = (permission) => {
    setPermissions((current) => ({
      ...current,
      [permission]: !current[permission],
    }));
  };

  const loadShares = async () => {
  if (!file?.id || !user?.id) return;

  try {
    setLoadingShares(true);
    const data = await getFileShares(user.id);

    setShares(
      data.filter((share) => share.file_id === file.id)
    );
  } catch (error) {
    console.error("Failed to load file shares:", error);
    alert("Could not load sharing details.");
  } finally {
    setLoadingShares(false);
  }
};

const handleRevoke = async (shareId) => {
  const confirmed = window.confirm(
    "Remove this person's access to the file?"
  );

  if (!confirmed) return;

  try {
    setRevokingId(shareId);

    await revokeShare(shareId);
    await loadShares();

    onShared?.();
  } catch (error) {
    console.error("Revoke file share error:", error);
    alert("Could not remove access. Please try again.");
  } finally {
    setRevokingId(null);
  }
};

useEffect(() => {
  if (file?.id && user?.id) {
    loadShares();
  }
}, [file?.id, user?.id]);

  const handleShareSubmit = async (event) => {
    event.preventDefault();

    if (!file || !user?.id) return;

    const email = shareEmail.trim().toLowerCase();

    if (!email) return;

    if (email === user.email?.toLowerCase()) {
      alert("You can't share a file with yourself.");
      return;
    }

    setSharing(true);

    try {
      await shareFile(file, user.id, email, permissions);

      alert(`"${file.name}" was shared with ${email}.`);

      onShared?.();
      onClose();
    } catch (error) {
      console.error("Share error:", error);
      alert("Could not share this file. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const handleClose = () => {
    if (sharing) return;

    setShareEmail("");
    setPermissions({
      can_edit: false,
      can_download: true,
      can_copy: true,
    });

    onClose();
  };

  if (!file) return null;

  return (
    <div
      className="share-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
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
            <p className="share-modal-eyebrow">
              SHARE FILE
            </p>

            <h2 id="share-modal-title">
              Share file
            </h2>

            <p className="share-modal-file-name">
              {file.name}
            </p>
          </div>

          <button
            type="button"
            className="share-modal-close"
            onClick={handleClose}
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
            onChange={(event) =>
              setShareEmail(event.target.value)
            }
            autoFocus
            required
          />

          <p className="share-modal-hint">
            Enter the email address of the person you want
            to share this file with.
          </p>

          <div className="share-permissions">
            <h3>Permissions</h3>

            <label className="share-permission-option">
              <input
                type="checkbox"
                checked={permissions.can_edit}
                onChange={() =>
                  handlePermissionChange("can_edit")
                }
                disabled={sharing}
              />

              <span>
                <strong>Allow editing</strong>
                <small>
                  Let the recipient edit this document when
                  collaborative editing is available.
                </small>
              </span>
            </label>

            <label className="share-permission-option">
              <input
                type="checkbox"
                checked={permissions.can_download}
                onChange={() =>
                  handlePermissionChange("can_download")
                }
                disabled={sharing}
              />

              <span>
                <strong>Allow downloading</strong>
                <small>
                  Let the recipient download the shared file.
                </small>
              </span>
            </label>

            <label className="share-permission-option">
              <input
                type="checkbox"
                checked={permissions.can_copy}
                onChange={() =>
                  handlePermissionChange("can_copy")
                }
                disabled={sharing}
              />

              <span>
                <strong>Allow copying to My Files</strong>
                <small>
                  Let the recipient save an independent copy
                  in their own files.
                </small>
              </span>
            </label>
          </div>

          <div className="share-modal-actions">
            <button
              type="button"
              className="share-cancel-button"
              onClick={handleClose}
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

        
<div className="folder-shares-list">
  <h3>People with access</h3>

  {loadingShares ? (
    <p>Loading...</p>
  ) : shares.length === 0 ? (
    <p>This file hasn't been shared yet.</p>
  ) : (
    shares.map((share) => (
      <div className="folder-share-row" key={share.id}>
        <div>
          <span>{share.shared_with_email}</span>
          <small style={{ display: "block", marginTop: "6px" }}>
            {share.can_edit ? "Can edit" : "View only"}
            {" · "}
            {share.can_download ? "Can download" : "No downloading"}
            {" · "}
            {share.can_copy ? "Can copy" : "No copying"}
          </small>
        </div>

        <button
          type="button"
          onClick={() => handleRevoke(share.id)}
          disabled={revokingId === share.id}
        >
          {revokingId === share.id ? "Removing..." : "Remove"}
        </button>
      </div>
    ))
  )}
</div>

      </div>
    </div>
  );
}

export default ShareFileModal;
