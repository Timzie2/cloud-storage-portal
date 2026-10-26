
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  shareFolder,
  getFolderShares,
  revokeFolderShare,
} from "../services/folders";

function ShareFolderModal({ folder, onClose, onShared }) {
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
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
    if (!folder?.id) return;

    try {
      setLoading(true);
      const data = await getFolderShares(folder.id);
      setShares(data);
    } catch (error) {
      console.error("Failed to load folder shares:", error);
      alert("Could not load sharing details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, [folder?.id]);

  const handleShare = async (event) => {
    event.preventDefault();

    if (!folder || !user?.id) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) return;

    if (normalizedEmail === user.email?.toLowerCase()) {
      alert("You can't share a folder with yourself.");
      return;
    }

    try {
      setSharing(true);

      await shareFolder(
        folder,
        user.id,
        normalizedEmail,
        permissions
      );

      setEmail("");
      setPermissions({
        can_edit: false,
        can_download: true,
        can_copy: true,
      });

      await loadShares();
      onShared?.();
    } catch (error) {
      console.error("Folder sharing error:", error);

      if (error.code === "23505") {
        alert("This folder has already been shared with that email.");
      } else {
        alert("Could not share this folder. Please try again.");
      }
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (shareId) => {
    if (!window.confirm("Remove this person's access to the folder?")) {
      return;
    }

    try {
      setRevokingId(shareId);
      await revokeFolderShare(shareId);
      await loadShares();
      onShared?.();
    } catch (error) {
      console.error("Revoke folder share error:", error);
      alert("Could not revoke access. Please try again.");
    } finally {
      setRevokingId(null);
    }
  };

  if (!folder) return null;

  return (
    <div
      className="share-modal-overlay"
      onClick={onClose}
    >
      <div
        className="share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-folder-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-modal-header">
          <div>
            <h2 id="share-folder-title">Share folder</h2>
            <p>{folder.name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleShare}>
          <label htmlFor="folder-share-email">
            Share with email address
          </label>

          <input
            id="folder-share-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter email address"
            required
          />

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
                  Let the recipient edit supported documents
                  when collaborative editing is available.
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
                  Allow downloading files from this shared folder.
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
                  Allow the recipient to save copies of the folder
                  and its contents.
                </small>
              </span>
            </label>
          </div>

          
<div className="share-modal-actions">
  <button
    type="button"
    className="share-cancel-button"
    onClick={onClose}
    disabled={sharing}
  >
    Cancel
  </button>

  <button
    type="submit"
    className="share-submit-button"
    disabled={sharing || !email.trim()}
  >
    {sharing ? "Sharing..." : "Share"}
  </button>
</div>

        </form>

        <div className="folder-shares-list">
          <h3>People with access</h3>

          {loading ? (
            <p>Loading...</p>
          ) : shares.length === 0 ? (
            <p>This folder hasn't been shared yet.</p>
          ) : (
            shares.map((share) => (
              <div className="folder-share-row" key={share.id}>
                <span>{share.shared_with_email}</span>

                <button
                  type="button"
                  onClick={() => handleRevoke(share.id)}
                  disabled={revokingId === share.id}
                >
                  {revokingId === share.id
                    ? "Removing..."
                    : "Remove"}
                </button>
              </div>
            ))
          )}
        </div>

        <p className="share-modal-note">
          People with access can view this folder and its contents.
        </p>
      </div>
    </div>
  );
}

export default ShareFolderModal;
