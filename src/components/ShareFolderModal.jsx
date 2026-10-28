import { useCallback, useEffect, useState } from "react";
import { Folder } from "lucide-react";
import "../styles/ShareModal.css";

import { useAuth } from "../context/AuthContext";

import {
  shareFolder,
  getFolderShares,
  revokeFolderShare,
} from "../services/folders";

import {
  checkRecipientAccount,
  getPreviousFileRecipients,
  removeFileRecipientSuggestion,
  clearFileRecipientHistory,
} from "../services/files";

function ShareFolderModal({ folder, onClose, onShared }) {
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [shares, setShares] = useState([]);

  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [showRecipientSuggestions, setShowRecipientSuggestions] =
    useState(false);

  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [removingRecipient, setRemovingRecipient] = useState(null);
  const [clearingHistory, setClearingHistory] = useState(false);

  const [recipientStatus, setRecipientStatus] = useState("idle");
  const [recipientName, setRecipientName] = useState("");
  const [recipientMessage, setRecipientMessage] = useState("");
  const [checkingRecipient, setCheckingRecipient] = useState(false);

  const [loadingShares, setLoadingShares] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const [expiryOption, setExpiryOption] = useState("never");
  const [customExpiryDate, setCustomExpiryDate] = useState("");

  const [permissions, setPermissions] = useState({
    can_edit: false,
    can_download: true,
    can_copy: true,
  });

  const normalizedEmail = email.trim().toLowerCase();

  const isCompleteEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  const filteredRecipientSuggestions = recipientSuggestions
    .filter((recipient) => {
      const recipientEmail =
        recipient.recipient_email?.trim().toLowerCase() || "";

      return (
        !normalizedEmail ||
        recipientEmail.includes(normalizedEmail)
      );
    })
    .slice(0, 5);

  const getLocalDateString = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const handlePermissionChange = (permission) => {
    setPermissions((current) => ({
      ...current,
      [permission]: !current[permission],
    }));
  };

  // Load existing shares for this folder.
  const loadShares = useCallback(async () => {
    if (!folder?.id) {
      setShares([]);
      setLoadingShares(false);
      return;
    }

    try {
      setLoadingShares(true);

      const data = await getFolderShares(folder.id);

      setShares(data || []);
    } catch (error) {
      console.error("Failed to load folder shares:", error);
      alert("Could not load sharing details.");
    } finally {
      setLoadingShares(false);
    }
  }, [folder?.id]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  // Load previously used recipient emails.
  useEffect(() => {
    let cancelled = false;

    async function loadRecipientHistory() {
      if (!user?.id) {
        setRecipientSuggestions([]);
        setLoadingRecipients(false);
        return;
      }

      try {
        setLoadingRecipients(true);

        const recipients = await getPreviousFileRecipients(user.id);

        if (!cancelled) {
          setRecipientSuggestions(recipients || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load recipient history:", error);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipients(false);
        }
      }
    }

    loadRecipientHistory();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Verify the recipient's NOVA account after they stop typing.
  useEffect(() => {
    setRecipientName("");
    setRecipientMessage("");

    if (!normalizedEmail || !isCompleteEmail) {
      setRecipientStatus("idle");
      setCheckingRecipient(false);
      return;
    }

    if (
      normalizedEmail === user?.email?.trim().toLowerCase()
    ) {
      setRecipientStatus("self");
      setRecipientMessage("You can't share a folder with yourself.");
      setCheckingRecipient(false);
      return;
    }

    let cancelled = false;

    setRecipientStatus("checking");
    setCheckingRecipient(true);

    const timeoutId = setTimeout(async () => {
      try {
        const result = await checkRecipientAccount(normalizedEmail);

        if (cancelled) return;

        if (result.registered) {
          setRecipientStatus("registered");
          setRecipientName(result.display_name || "");

          setRecipientMessage(
            result.display_name
              ? `${result.display_name} has a NOVA account.`
              : "NOVA account found."
          );
        } else {
          setRecipientStatus("unregistered");
          setRecipientMessage(
            "No NOVA account found for this email. They may need to join NOVA first."
          );
        }
      } catch (error) {
        if (cancelled) return;

        setRecipientStatus("error");
        setRecipientMessage(
          error?.message ||
            "Could not verify this email. Please try again."
        );
      } finally {
        if (!cancelled) {
          setCheckingRecipient(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [normalizedEmail, isCompleteEmail, user?.email]);

  const handleClose = () => {
    if (sharing) return;

    setEmail("");
    setShowRecipientSuggestions(false);

    setRecipientStatus("idle");
    setRecipientName("");
    setRecipientMessage("");
    setCheckingRecipient(false);

    setExpiryOption("never");
    setCustomExpiryDate("");

    setPermissions({
      can_edit: false,
      can_download: true,
      can_copy: true,
    });

    onClose?.();
  };

  const handleRemoveSuggestion = async (recipient) => {
    try {
      setRemovingRecipient(recipient.id);

      await removeFileRecipientSuggestion(
        user.id,
        recipient.recipient_email
      );

      setRecipientSuggestions((current) =>
        current.filter((item) => item.id !== recipient.id)
      );
    } catch (error) {
      console.error("Failed to remove recipient suggestion:", error);
      alert("Could not remove this suggestion.");
    } finally {
      setRemovingRecipient(null);
    }
  };

  const handleClearHistory = async () => {
    if (
      !window.confirm(
        "Clear your entire recipient suggestion history?"
      )
    ) {
      return;
    }

    try {
      setClearingHistory(true);

      await clearFileRecipientHistory(user.id);
      setRecipientSuggestions([]);
    } catch (error) {
      console.error("Failed to clear recipient history:", error);
      alert("Could not clear recipient history.");
    } finally {
      setClearingHistory(false);
    }
  };

  const handleRevoke = async (shareId) => {
    if (
      !window.confirm(
        "Remove this person's access to the folder?"
      )
    ) {
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

  const handleShareSubmit = async (event) => {
    event.preventDefault();

    if (!folder || !user?.id || !normalizedEmail) return;

    if (
      normalizedEmail === user.email?.trim().toLowerCase()
    ) {
      alert("You can't share a folder with yourself.");
      return;
    }

    if (
      recipientStatus !== "registered" ||
      checkingRecipient
    ) {
      alert("Please enter a verified NOVA account email.");
      return;
    }

    let expiresAt = null;

    if (expiryOption === "1day") {
      expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();
    } else if (expiryOption === "7days") {
      expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString();
    } else if (expiryOption === "30days") {
      expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();
    } else if (expiryOption === "custom") {
      if (!customExpiryDate) {
        alert("Please select an expiry date.");
        return;
      }

      const selectedDate = new Date(
        `${customExpiryDate}T23:59:59`
      );

      if (
        Number.isNaN(selectedDate.getTime()) ||
        selectedDate.getTime() <= Date.now()
      ) {
        alert("Please select a future expiry date.");
        return;
      }

      expiresAt = selectedDate.toISOString();
    }

    try {
      setSharing(true);

      await shareFolder(folder, user.id, normalizedEmail, {
        ...permissions,
        expires_at: expiresAt,
      });

      await loadShares();
      onShared?.();

      alert(`"${folder.name}" was shared with ${normalizedEmail}.`);

      handleClose();
    } catch (error) {
      console.error("Folder sharing error:", error);

      if (error.code === "23505") {
        alert("This folder has already been shared with that email.");
      } else {
        alert(
          error?.message ||
            "Could not share this folder. Please try again."
        );
      }
    } finally {
      setSharing(false);
    }
  };

  if (!folder) return null;

  return (
    <div
  className="share-modal-overlay share-folder-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
  className="share-modal share-folder-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-folder-title"
      >
        {/* Modal header */}
        
<div className="share-modal-header share-folder-header">
  <div className="share-file-heading">
    
<div className="share-file-icon share-folder-header-icon">
  <Folder size={34} strokeWidth={1.8} />
</div>


    <div className="share-file-heading-info">
      <p className="share-modal-eyebrow">FOLDER SHARING</p>

      <h2 id="share-folder-title">Share folder</h2>

      <p
        className="share-modal-file-name share-folder-header-name"
        title={folder.name}
      >
        {folder.name}
      </p>

      <span className="share-file-meta">
        Manage access and permissions
      </span>
    </div>
  </div>

  <button
    type="button"
    className="share-modal-close"
    onClick={handleClose}
    disabled={sharing}
    aria-label="Close share dialog"
  >
    ×
  </button>
</div>


        <form onSubmit={handleShareSubmit}>
          {/* Section 01: Add people */}
          <section className="share-form-section">
            <div className="share-section-heading">
              <span className="share-section-number">01</span>

              <div>
                <h3>Add people</h3>
                <p>Share this folder with someone on NOVA.</p>
              </div>
            </div>

            <label
              className="share-field-label"
              htmlFor="folder-share-email"
            >
              Email address
            </label>

            <div className="recipient-autocomplete">
              <input
                id="folder-share-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onFocus={() => setShowRecipientSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setShowRecipientSuggestions(false);
                  }, 150);
                }}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setShowRecipientSuggestions(true);
                }}
                autoComplete="off"
                disabled={sharing}
                required
              />

              
{showRecipientSuggestions && !isCompleteEmail && (
  <div className="recipient-suggestions">
    {recipientSuggestions.length > 0 && (
      <div className="recipient-suggestions-header">
        <span>Previous recipients</span>

        <button
          type="button"
          className="recipient-clear-history"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleClearHistory}
          disabled={clearingHistory}
        >
          {clearingHistory ? "Clearing..." : "Clear history"}
        </button>
      </div>
    )}

    {loadingRecipients ? (
      <p className="recipient-suggestions-empty">
        Loading previous recipients...
      </p>
    ) : (
      <>
        {filteredRecipientSuggestions.map((recipient) => (
          <div
            className="recipient-suggestion-row"
            key={recipient.id}
          >
            <button
              type="button"
              className="recipient-suggestion-select"
              onMouseDown={(event) => {
                event.preventDefault();
                setEmail(recipient.recipient_email);
                setShowRecipientSuggestions(false);
              }}
            >
              <span className="recipient-suggestion-avatar">
                {(recipient.recipient_email || "?")
                  .charAt(0)
                  .toUpperCase()}
              </span>

              <span className="recipient-suggestion-email">
                {recipient.recipient_email}
              </span>
            </button>

            <button
              type="button"
              className="recipient-suggestion-remove"
              aria-label={`Remove ${recipient.recipient_email} from suggestions`}
              title="Remove suggestion"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleRemoveSuggestion(recipient)}
              disabled={removingRecipient === recipient.id}
            >
              {removingRecipient === recipient.id ? "…" : "×"}
            </button>
          </div>
        ))}

        {normalizedEmail.length >= 2 &&
          filteredRecipientSuggestions.length === 0 && (
            <p className="recipient-suggestions-empty">
              No previous recipients found.
            </p>
          )}
      </>
    )}
  </div>
)}

            </div>

            {/* Recipient verification status */}
            {normalizedEmail && isCompleteEmail && (
              <div
                className={`recipient-status recipient-status-${recipientStatus}`}
                role="status"
              >
                {checkingRecipient ? (
                  <p>Checking NOVA account...</p>
                ) : (
                  <>
                    
{recipientStatus === "registered" && (
  <div className="share-folder-account-found">
    <div className="share-folder-account-check">
      <span>✓</span>
    </div>

    <div className="share-folder-account-info">
      <strong>{recipientName || "NOVA user"}</strong>
      <p>NOVA account found.</p>
    </div>

    <span className="share-folder-account-badge">
      NOVA user
    </span>
  </div>
)}


                    {recipientStatus === "unregistered" && (
                      <p>{recipientMessage}</p>
                    )}

                    {recipientStatus === "self" && (
                      <p>{recipientMessage}</p>
                    )}

                    {recipientStatus === "error" && (
                      <p>{recipientMessage}</p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          
{/* Sections 02 and 03: Permissions and expiry */}
<div className="share-folder-options-grid">
  <section className="share-form-section share-folder-permissions-section">
    <div className="share-section-heading">
      <span className="share-section-number">02</span>
      <div>
        <h3>Set permissions</h3>
        <p>Control what the recipient can do.</p>
      </div>
    </div>

    <div className="share-permissions">
      <label className="share-permission-option">
        <input
          type="checkbox"
          checked={permissions.can_edit}
          onChange={() => handlePermissionChange("can_edit")}
          disabled={sharing}
        />
        <span>
          <strong>Allow editing</strong>
          <small>Grant edit permission for collaborative documents.</small>
        </span>
      </label>

      <label className="share-permission-option">
        <input
          type="checkbox"
          checked={permissions.can_download}
          onChange={() => handlePermissionChange("can_download")}
          disabled={sharing}
        />
        <span>
          <strong>Allow downloading</strong>
          <small>Download files from this shared folder.</small>
        </span>
      </label>

      <label className="share-permission-option">
        <input
          type="checkbox"
          checked={permissions.can_copy}
          onChange={() => handlePermissionChange("can_copy")}
          disabled={sharing}
        />
        <span>
          <strong>Allow copying to My Files</strong>
          <small>Save an independent copy of this folder.</small>
        </span>
      </label>
    </div>
  </section>

  <section className="share-folder-expiry-section">
    <div className="share-section-heading">
      <span className="share-section-number">03</span>
      <div>
        <h3>Link expiry</h3>
        <p>Choose how long access should last.</p>
      </div>
    </div>

    <div className="share-folder-expiry-options">
      {[
        { value: "never", label: "Never expires" },
        { value: "1day", label: "1 day" },
        { value: "7days", label: "7 days" },
        { value: "30days", label: "30 days" },
        { value: "custom", label: "Custom date" },
      ].map((option) => (
        <label
          className={`share-folder-expiry-option ${
            expiryOption === option.value ? "selected" : ""
          }`}
          key={option.value}
        >
          <input
            type="radio"
            name="folder-expiry-option"
            value={option.value}
            checked={expiryOption === option.value}
            onChange={() => setExpiryOption(option.value)}
            disabled={sharing}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>

    {expiryOption === "custom" && (
      <div className="share-custom-expiry">
        <label
          className="share-field-label"
          htmlFor="folder-custom-expiry-date"
        >
          Expiry date
        </label>
        <input
          id="folder-custom-expiry-date"
          type="date"
          value={customExpiryDate}
          min={getLocalDateString()}
          onChange={(event) => setCustomExpiryDate(event.target.value)}
          disabled={sharing}
          required
        />
      </div>
    )}
  </section>
</div>

{/* Section 04: Existing access */}
        <section className="share-existing-access">
          <div className="share-section-heading">
            <span className="share-section-number">04</span>

            <div>
              <h3>People with access</h3>
              <p>Manage who can access this folder.</p>
            </div>
          </div>

          <div className="folder-shares-list">
            {loadingShares ? (
              <p>Loading sharing details...</p>
            ) : shares.length === 0 ? (
              <p>This folder hasn't been shared yet.</p>
            ) : (
              shares.map((share) => (
                <div className="folder-share-row" key={share.id}>
                  <div className="folder-share-person">
                    <span className="folder-share-avatar">
                      {(share.shared_with_email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>

                    <div className="folder-share-person-details">
                      <span>{share.shared_with_email}</span>

                      <small>
                        {share.can_edit ? "Can edit" : "View only"}
                        {" · "}
                        {share.can_download
                          ? "Can download"
                          : "No downloading"}
                        {" · "}
                        {share.can_copy ? "Can copy" : "No copying"}
                        {" · "}
                        {share.expires_at
                          ? `Expires ${formatDate(share.expires_at)}`
                          : "Never expires"}
                      </small>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="folder-share-remove"
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
        </section>


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
              disabled={
                sharing ||
                !normalizedEmail ||
                recipientStatus !== "registered" ||
                checkingRecipient
              }
            >
              {sharing ? "Sharing..." : "Share folder"}
            </button>
          </div>
        </form>

        <p className="share-modal-note">
          People with access can view this folder and its contents.
          Their available actions depend on the permissions you selected.
        </p>
      </div>
    </div>
  );
}

export default ShareFolderModal;