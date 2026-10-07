import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Save,
  Loader2,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getProfile,
  updateProfile,
} from "../services/profile";
import NovaLoader from "../components/NovaLoader";

function Settings() {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const data = await getProfile(user.id);

        setProfile(data);
        setDisplayName(data?.display_name || "");
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!user) return;

    setSaving(true);
    setMessage("");

    try {
      const updatedProfile = await updateProfile(
        user.id,
        {
          display_name: displayName.trim() || null,
        }
      );

      setProfile(updatedProfile);
setDisplayName(updatedProfile.display_name || "");
setMessage("Profile updated successfully.");

window.dispatchEvent(
  new CustomEvent("profile-updated", {
    detail: updatedProfile,
  })
);
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage("Could not update your profile.");
    } finally {
      setSaving(false);
    }
  };

  const avatarLetter = (
    displayName ||
    user?.email ||
    "U"
  )
    .charAt(0)
    .toUpperCase();

  return (
    <main className="dashboard settings-page">
      <section className="dashboard-content">
        <p className="dashboard-eyebrow">
          Preferences
        </p>

        <h1 className="dashboard-title">
          Settings
        </h1>

        <p className="dashboard-subtitle">
          Manage your NOVA account and preferences.
        </p>

        <div className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2>Profile</h2>

              <p>
                Update the information associated with your
                NOVA account.
              </p>
            </div>
          </div>

          {loading ? (
  <NovaLoader message="Loading your settings..." />
) : (
            <form
              className="profile-form"
              onSubmit={handleSaveProfile}
            >
              <div className="profile-preview">
                <div className="profile-avatar">
                  {avatarLetter}
                </div>

                <div>
                  <strong>
                    {displayName || "Your name"}
                  </strong>

                  <span>
                    {user?.email}
                  </span>
                </div>
              </div>

              <div className="settings-field">
                <label htmlFor="display-name">
                  Display name
                </label>

                <div className="settings-input-wrapper">
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

              <div className="settings-field">
                <label htmlFor="account-email">
                  Email address
                </label>

                <div className="settings-input-wrapper settings-input-disabled">
                  <Mail size={17} />

                  <input
                    id="account-email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                  />
                </div>

                <span className="settings-field-hint">
                  Your account email is managed by
                  authentication.
                </span>
              </div>

              <div className="settings-form-footer">
                {message && (
                  <span className="settings-message">
                    {message}
                  </span>
                )}

                <button
                  type="submit"
                  className="settings-save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={16}
                        className="settings-spinner"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save changes
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

export default Settings;