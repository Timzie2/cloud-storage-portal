import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Mail,
  User,
  Save,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getProfile, updateProfile } from "../services/profile";
import NovaLoader from "../components/NovaLoader";

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError("");

        const data = await getProfile(user.id);

        setDisplayName(data?.display_name || "");
      } catch (err) {
        console.error("Profile load error:", err);
        setError("Unable to load your profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSave = async (event) => {
    event.preventDefault();

    if (!user?.id) return;

    try {
      setSaving(true);
      setMessage("");
      setError("");

      await updateProfile(user.id, {
        display_name: displayName.trim(),
      });

      window.dispatchEvent(new Event("profile-updated"));

      setMessage("Profile updated successfully.");
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const initial = (
    displayName ||
    user?.email ||
    "U"
  )
    .charAt(0)
    .toUpperCase();

  return (
    <main className="dashboard profile-page">
      <section className="dashboard-content">
        <button
          type="button"
          className="profile-back-button"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={17} />
          <span>Back to dashboard</span>
        </button>

        <div className="profile-page-header">
          <div>
            <p className="dashboard-eyebrow">
              Account
            </p>

            <h1 className="dashboard-title">
              Profile
            </h1>

            <p className="dashboard-subtitle">
              Manage your personal information and account details.
            </p>
          </div>
        </div>

        <div className="profile-layout">
          <section className="profile-card profile-card-main">
            <div className="profile-card-heading">
              <div>
                <h2>Personal information</h2>
                <p>
                  Update the information associated with your NOVA account.
                </p>
              </div>
            </div>

            {loading ? (
  <NovaLoader message="Loading your profile..." />
) : (
              <form onSubmit={handleSave}>
                <div className="profile-avatar-section">
                  <div className="profile-large-avatar">
                    {initial}
                  </div>

                  <div>
                    <strong>Your profile</strong>
                    <p>
                      Your initial is currently used as your avatar.
                    </p>
                  </div>
                </div>

                <div className="profile-form-grid">
                  <div className="profile-field">
                    <label htmlFor="display-name">
                      Display name
                    </label>

                    <div className="profile-input-wrapper">
                      <User size={17} />

                      <input
                        id="display-name"
                        type="text"
                        value={displayName}
                        onChange={(event) =>
                          setDisplayName(event.target.value)
                        }
                        placeholder="Enter your name"
                        maxLength={80}
                      />
                    </div>
                  </div>

                  <div className="profile-field">
                    <label htmlFor="profile-email">
                      Email address
                    </label>

                    <div className="profile-input-wrapper disabled">
                      <Mail size={17} />

                      <input
                        id="profile-email"
                        type="email"
                        value={user?.email || ""}
                        disabled
                        readOnly
                      />
                    </div>

                    <span className="profile-field-hint">
                      Your email address is managed by your account.
                    </span>
                  </div>
                </div>

                {message && (
                  <div className="profile-message success">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="profile-message error">
                    {error}
                  </div>
                )}

                <div className="profile-form-actions">
                  <button
                    type="submit"
                    className="profile-save-button"
                    disabled={saving}
                  >
                    <Save size={17} />
                    <span>
                      {saving ? "Saving..." : "Save changes"}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside className="profile-card profile-account-card">
            <div className="profile-card-icon">
              <Camera size={20} />
            </div>

            <h2>Account</h2>

            <p>
              Your NOVA account gives you a private space to store,
              organize, access and share your files.
            </p>

            <div className="profile-account-item">
              <span>Status</span>
              <strong>Active</strong>
            </div>

            <div className="profile-account-item">
              <span>Account email</span>
              <strong>{user?.email || "—"}</strong>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default Profile;