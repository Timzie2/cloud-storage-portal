import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { shareFile } from "../services/files";

function ShareFileModal({ file, onClose, onShared }) {
  const { user } = useAuth();

  const [shareEmail, setShareEmail] = useState("");
  const [sharing, setSharing] = useState(false);

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
      await shareFile(file, user.id, email);

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
      </div>
    </div>
  );
}

export default ShareFileModal;