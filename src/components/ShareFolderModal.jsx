
import { useState } from "react";
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

  // Load existing shares when the modal opens.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useState(() => {
    loadShares();
  });

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

      await shareFolder(folder, user.id, normalizedEmail);

      setEmail("");
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
    <div className="share-modal-overlay" onClick={onClose}>
      <div
        className="share-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-modal-header">
          <div>
            <h2>Share folder</h2>
            <p>{folder.name}</p>
          </div>

          <button type="button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleShare}>
          <label htmlFor="folder-share-email">
            Share with email address
          </label>

          <div className="share-modal-input-row">
            <input
              id="folder-share-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter email address"
              required
            />

            <button type="submit" disabled={sharing}>
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
                  {revokingId === share.id ? "Removing..." : "Remove"}
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
