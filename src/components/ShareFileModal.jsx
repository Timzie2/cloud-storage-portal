import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import "../styles/ShareModal.css";
import { useAuth } from "../context/AuthContext";
import {
  shareFile,
  checkRecipientAccount,
  getPreviousFileRecipients,
  removeFileRecipientSuggestion,
  clearFileRecipientHistory,
  getFileShares,
  revokeShare,
} from "../services/files";

function ShareFileModal({ file, onClose, onShared }) {
  const { user } = useAuth();

  const [shareEmail, setShareEmail] = useState("");
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

  const [expiryOption, setExpiryOption] = useState("never");
  const [customExpiryDate, setCustomExpiryDate] = useState("");
  

  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [revokingId, setRevokingId] = useState(null);

  const [permissions, setPermissions] = useState({
    can_edit: false,
    can_download: true,
    can_copy: true,
  });

  const fileExtension =
    file?.name?.split(".").pop()?.toUpperCase() || "FILE";

  const formatFileSize = (bytes) => {
    if (bytes == null || Number.isNaN(Number(bytes))) {
      return null;
    }

    const size = Number(bytes);

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const getLocalDateString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  
const normalizedSearch = shareEmail.trim().toLowerCase();
const isCompleteEmail =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedSearch);

const filteredRecipientSuggestions = recipientSuggestions
  .filter((recipient) => {
    const email = recipient.recipient_email?.trim().toLowerCase() || "";
    return !normalizedSearch || email.includes(normalizedSearch);
  })
  .slice(0, 5);


  const handlePermissionChange = (permission) => {
    setPermissions((current) => ({
      ...current,
      [permission]: !current[permission],
    }));
  };

  const loadShares = useCallback(async () => {
    if (!file?.id || !user?.id) {
      setShares([]);
      setLoadingShares(false);
      return;
    }

    try {
      setLoadingShares(true);

      const data = await getFileShares(user.id);

      setShares(
        (data || []).filter((share) => share.file_id === file.id)
      );
    } catch (error) {
      console.error("Failed to load file shares:", error);
      alert("Could not load sharing details.");
    } finally {
      setLoadingShares(false);
    }
  }, [file?.id, user?.id]);

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
    const email = shareEmail.trim().toLowerCase();

    setRecipientName("");
    setRecipientMessage("");

    if (!email) {
      setRecipientStatus("idle");
      setCheckingRecipient(false);
      return;
    }

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  setRecipientStatus("idle");
  setCheckingRecipient(false);
  return;
}

    if (email === user?.email?.trim().toLowerCase()) {
      setRecipientStatus("self");
      setRecipientMessage("You can't share a file with yourself.");
      setCheckingRecipient(false);
      return;
    }

    let cancelled = false;

    setRecipientStatus("checking");
    setCheckingRecipient(true);

    const timeoutId = setTimeout(async () => {
      try {
        const result = await checkRecipientAccount(email);

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
          error?.message || "Could not verify this email. Please try again."
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
  }, [shareEmail, user?.email]);

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

  const handleShareSubmit = async (event) => {
    event.preventDefault();

    if (!file || !user?.id) return;

    const email = shareEmail.trim().toLowerCase();

    if (!email) return;

    if (email === user.email?.trim().toLowerCase()) {
      alert("You can't share a file with yourself.");
      return;
    }

    if (recipientStatus !== "registered" || checkingRecipient) {
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

      await shareFile(file, user.id, email, {
        ...permissions,
        expires_at: expiresAt,
      });

      alert(`"${file.name}" was shared with ${email}.`);

      await loadShares();
      onShared?.();
      handleClose(true);
    } catch (error) {
      console.error("Error sharing file:", error);
      alert(
        error?.message || "Could not share this file. Please try again."
      );
    } finally {
      setSharing(false);
    }
  };

const handleClose = (force = false) => {
  if (sharing && !force) return;

    setShareEmail("");
    setShowRecipientSuggestions(false);
    setRecipientStatus("idle");
    setRecipientName("");
    setRecipientMessage("");
    setCheckingRecipient(false);

    setPermissions({
      can_edit: false,
      can_download: true,
      can_copy: true,
    });

    setExpiryOption("never");
    setCustomExpiryDate("");

    onClose?.();
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
        {/* Modal header */}
        
<div className="share-modal-header share-file-modal-header">
  <div className="share-file-heading">
    <div className="share-file-icon share-file-header-icon">
      <FileText size={34} strokeWidth={1.8} />
    </div>

    <div className="share-file-heading-info">
      <p className="share-modal-eyebrow">FILE SHARING</p>

      <h2 id="share-modal-title">Share file</h2>

      <p
        className="share-modal-file-name share-file-header-name"
        title={file.name}
      >
        {file.name}
      </p>

      <span className="share-file-meta">
        {fileExtension} file
        {formatFileSize(file.size)
          ? ` · ${formatFileSize(file.size)}`
          : ""}
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
                <p>Share this file with someone on NOVA.</p>
              </div>
            </div>

            <label
              className="share-field-label"
              htmlFor="share-email"
            >
              Email address
            </label>

            <div className="recipient-autocomplete">
              <input
                id="share-email"
                type="email"
                placeholder="name@example.com"
                value={shareEmail}
                onFocus={() => {
  setShowRecipientSuggestions(true);
}}
onBlur={() => {
  setTimeout(() => {
    setShowRecipientSuggestions(false);
  }, 150);
}}
                onChange={(event) => {
                  setShareEmail(event.target.value);
                  setShowRecipientSuggestions(true);
                }}
                autoComplete="off"
                disabled={sharing}
                required
              />

{showRecipientSuggestions && !isCompleteEmail && (
                  <div className="recipient-suggestions">
                    {loadingRecipients ? (
                      <p className="recipient-suggestions-empty">
                        Loading previous recipients...
                      </p>
                    ) : (
                      <>
                        {recipientSuggestions.length > 0 && (
                          <div className="recipient-suggestions-header">
                            <span>Previous recipients</span>

                            <button
                              type="button"
                              onClick={handleClearHistory}
                              disabled={clearingHistory}
                            >
                              {clearingHistory
                                ? "Clearing..."
                                : "Clear history"}
                            </button>
                          </div>
                        )}


{filteredRecipientSuggestions.map((recipient) => (
  <div className="recipient-suggestion" key={recipient.id}>
    <button
  type="button"
  className="recipient-suggestion-select"
  onMouseDown={(event) => {
    event.preventDefault();
    setShareEmail(recipient.recipient_email);
    setShowRecipientSuggestions(false);
  }}
>
      <span className="recipient-suggestion-avatar">
        {recipient.recipient_email.charAt(0).toUpperCase()}
      </span>

      <span>{recipient.recipient_email}</span>
    </button>

    <button
  type="button"
  className="recipient-suggestion-remove"
  aria-label={`Remove ${recipient.recipient_email} from suggestions`}
  title="Remove suggestion"
  disabled={removingRecipient === recipient.id}
  onMouseDown={(event) => {
    event.preventDefault();
  }}
  onClick={() => handleRemoveSuggestion(recipient)}
>
  {removingRecipient === recipient.id ? "…" : "×"}
</button>
  </div>
))}

{normalizedSearch.length >= 2 &&
  !loadingRecipients &&
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

            {checkingRecipient && (
              <p className="share-recipient-status checking">
                <span className="share-status-dot" />
                Checking for a NOVA account...
              </p>
            )}

            {!checkingRecipient &&
              recipientStatus === "registered" && (
                <div className="share-recipient-verified">
                  <span className="share-verified-icon">✓</span>

                  <div>
                    <strong>{recipientName || "NOVA user"}</strong>
                    <p>{recipientMessage}</p>
                  </div>

                  <span className="share-verified-badge">
                    NOVA user
                  </span>
                </div>
              )}

            {!checkingRecipient &&
              ["unregistered", "self", "error"].includes(
                recipientStatus
              ) && (
                <p className="share-recipient-status error">
                  {recipientMessage}
                </p>
              )}
          </section>

          {/* Section 02: Permissions */}
          <div className="share-settings-grid">
          <section className="share-form-section share-permissions">
            <div className="share-section-heading">
              <span className="share-section-number">02</span>
              <div>
                <h3>Set permissions</h3>
                <p>Control what the recipient can do.</p>
              </div>
            </div>

            <div className="share-permissions-panel">
              <label className="share-permission-option">
                <input
                  type="checkbox"
                  checked={permissions.can_edit}
                  onChange={() => handlePermissionChange("can_edit")}
                  disabled={sharing}
                />

                <span className="share-permission-copy">
                  <strong>Allow editing</strong>
                  <small>
                    Grant edit permission for collaborative documents.
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

                <span className="share-permission-copy">
                  <strong>Allow downloading</strong>
                  <small>Download a copy of this file.</small>
                </span>
              </label>

              <label className="share-permission-option">
                <input
                  type="checkbox"
                  checked={permissions.can_copy}
                  onChange={() => handlePermissionChange("can_copy")}
                  disabled={sharing}
                />

                <span className="share-permission-copy">
                  <strong>Allow copying to My Files</strong>
                  <small>
                    Save an independent copy to their account.
                  </small>
                </span>
              </label>
            </div>
          </section>

          {/* Section 03: Expiry */}
          <section className="share-form-section share-expiry-section">
            <div className="share-section-heading">
              <span className="share-section-number">03</span>
              <div>
                <h3>Link expiry</h3>
                <p>Choose how long access should last.</p>
              </div>
            </div>

            <div className="share-expiry-options">
              {[
                { value: "never", label: "Never expires" },
                { value: "1day", label: "1 day" },
                { value: "7days", label: "7 days" },
                { value: "30days", label: "30 days" },
                { value: "custom", label: "Custom date" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`share-expiry-option ${
                    expiryOption === option.value ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="share-expiry"
                    value={option.value}
                    checked={expiryOption === option.value}
                    onChange={(event) =>
                      setExpiryOption(event.target.value)
                    }
                    disabled={sharing}
                  />

                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            {expiryOption === "custom" && (
              <div className="share-custom-expiry">
                <label htmlFor="custom-expiry-date">
                  Expiry date
                </label>

                <input
                  id="custom-expiry-date"
                  type="date"
                  value={customExpiryDate}
                  min={getLocalDateString()}
                  onChange={(event) =>
                    setCustomExpiryDate(event.target.value)
                  }
                  disabled={sharing}
                  required
                />
              </div>
            )}
          </section>
          </div>

          {/* Section 04: Existing access */}
        <section className="folder-shares-list share-existing-access">
          <div className="share-section-heading">
            <span className="share-section-number">04</span>
            <div>
              <h3>People with access</h3>
              <p>Manage who can access this file.</p>
            </div>
          </div>

          {loadingShares ? (
            <p className="share-access-empty">Loading access details...</p>
          ) : shares.length === 0 ? (
            <p className="share-access-empty">
              This file hasn't been shared yet.
            </p>
) : (
  <div className="share-access-scroll">
    {shares.map((share) => (
      <div className="folder-share-row" key={share.id}>
                <div className="share-access-person">
                  <span className="share-access-avatar">
                    {share.shared_with_email?.charAt(0).toUpperCase() ||
                      "U"}
                  </span>

                  <div className="share-access-person-info">
                    <strong>{share.shared_with_email}</strong>

                    <small>
                      {share.can_edit ? "Can edit" : "View only"}
                      {" · "}
                      {share.can_download
                        ? "Can download"
                        : "No downloading"}
                      {" · "}
                      {share.can_copy ? "Can copy" : "No copying"}
                    </small>

                    <small className="share-access-expiry">
                      {share.expires_at
                        ? `Expires ${formatDate(share.expires_at)}`
                        : "Never expires"}
                    </small>
                  </div>
                </div>

                <button
                  type="button"
                  className="share-remove-access"
                  onClick={() => handleRevoke(share.id)}
                  disabled={revokingId === share.id}
                >
                  {revokingId === share.id ? "Removing..." : "Remove"}
                </button>
                    </div>
    ))}
  </div>
)}
        </section>
          
          {/* Form actions */}
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
                checkingRecipient ||
                recipientStatus !== "registered"
              }
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
