import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../services/supabase";
import Logo from "../components/Logo";

function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setMessage(error.message);
          setMessageType("error");
          return;
        }

        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          setMessage(error.message);
          setMessageType("error");
          return;
        }

        setMessage(
          "Account created successfully. Check your email to confirm your account."
        );
        setMessageType("success");
      }
    } catch (error) {
      console.error("Authentication error:", error);

      setMessage("Something went wrong. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin((current) => !current);

    setEmail("");
    setPassword("");

    setMessage("");
    setMessageType("");

    setShowPassword(false);
  };

  return (
    <main className="auth-page">
      {/* Background atmosphere */}
      <div className="auth-background-glow auth-glow-one" />
      <div className="auth-background-glow auth-glow-two" />

      <div className="auth-container">
        {/* Brand */}
        <div className="auth-brand">
          <Logo />
        </div>

        {/* Auth card */}
        <section className="auth-card">
          {/* Header */}
          <div className="auth-card-header">
            <div className="auth-icon">
              {isLogin ? (
                <LockKeyhole size={19} strokeWidth={1.8} />
              ) : (
                <ShieldCheck size={19} strokeWidth={1.8} />
              )}
            </div>

            <p className="auth-eyebrow">
              {isLogin ? "Welcome back" : "Get started"}
            </p>

            <h1>
              {isLogin
                ? "Sign in to NOVA"
                : "Create your account"}
            </h1>

            <p>
              {isLogin
                ? "Access your files from anywhere."
                : "Create your personal digital space."}
            </p>
          </div>

          {/* Form */}
          <form
            className="auth-form"
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Email */}
            <div className="auth-field">
              <label htmlFor="auth-email">
                Email address
              </label>

              <div className="auth-input-wrapper">
                <Mail
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />

                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={email}
                  placeholder="you@example.com"
                  onChange={(event) => {
                    setEmail(event.target.value);

                    if (message) {
                      setMessage("");
                      setMessageType("");
                    }
                  }}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="auth-password">
                  Password
                </label>

                {isLogin && (
                  <button
                    type="button"
                    className="auth-forgot-button"
                    onClick={() => {
                      setMessage(
                        "Password reset will be available soon."
                      );
                      setMessageType("success");
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <div className="auth-input-wrapper">
                <LockKeyhole
                  size={17}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />

                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  placeholder="Enter your password"
                  onChange={(event) => {
                    setPassword(event.target.value);

                    if (message) {
                      setMessage("");
                      setMessageType("");
                    }
                  }}
                  autoComplete={
                    isLogin
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  title={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div
                className={`auth-message ${messageType}`}
                role="alert"
              >
                {message}
              </div>
            )}

            {/* Submit */}
            <button
              className="auth-submit-button"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? isLogin
                    ? "Signing in..."
                    : "Creating account..."
                  : isLogin
                  ? "Sign in"
                  : "Create account"}
              </span>

              {!loading && (
                <ArrowRight
                  size={17}
                  strokeWidth={2}
                />
              )}
            </button>
          </form>

          {/* Switch */}
          <div className="auth-switch">
            <span>
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}
            </span>

            <button
              type="button"
              onClick={switchMode}
            >
              {isLogin ? "Create one" : "Sign in"}
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="auth-footer">
          <span>Secure cloud storage</span>
          <span>•</span>
          <span>Your files, everywhere.</span>
        </div>
      </div>
    </main>
  );
}

export default Auth;