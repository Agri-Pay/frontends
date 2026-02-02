// src/pages/ResetPasswordPage.jsx
import { useState, useEffect } from "react";
import { supabase } from "./createclient";
import { useNavigate } from "react-router-dom";
import Navbar from "./navbar";
import "./login.css";
import { toast } from "react-hot-toast";

const ResetPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  // Check if user arrived via valid reset link
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        setError("Invalid or expired reset link. Please request a new one.");
      }
      setCheckingSession(false);
    };
    checkSession();
  }, []);

  // Password validation
  useEffect(() => {
    if (password) {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(
        password
      );
      const isLongEnough = password.length >= 8;

      if (!isLongEnough) {
        setPasswordError("Password must be at least 8 characters long.");
      } else if (
        !hasUpperCase ||
        !hasLowerCase ||
        !hasNumber ||
        !hasSpecialChar
      ) {
        setPasswordError(
          "Password must include uppercase, lowercase, number, and special character."
        );
      } else {
        setPasswordError("");
      }
    } else {
      setPasswordError("");
    }

    if (confirmPassword) {
      if (password !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match.");
      } else {
        setConfirmPasswordError("Passwords match!");
      }
    } else {
      setConfirmPasswordError("");
    }
  }, [password, confirmPassword]);

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (passwordError || (confirmPassword && password !== confirmPassword)) {
      setError("Please fix the errors before submitting.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError(error.message);
      toast.error("Failed to reset password");
    } else {
      toast.success("Password reset successfully!");
      // Sign out after password reset so user can log in with new password
      await supabase.auth.signOut();
      navigate("/login");
    }
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="login-page-container">
        <Navbar />
        <main className="main-content">
          <div className="login-card">
            <div className="card-header">
              <h2 className="card-title">Verifying...</h2>
              <p className="card-subtitle">Please wait while we verify your reset link.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="login-page-container">
        <Navbar />
        <main className="main-content">
          <div className="login-card">
            <div className="card-header">
              <h2 className="card-title">Invalid Link</h2>
              <p className="card-subtitle">
                This password reset link is invalid or has expired.
              </p>
            </div>
            {error && <p className="error-message">{error}</p>}
            <p className="form-footer">
              <a href="/forgot-password">Request a new reset link</a>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="login-page-container">
      <Navbar />
      <main className="main-content">
        <div className="login-card">
          <div className="card-header">
            <h2 className="card-title">Reset Password</h2>
            <p className="card-subtitle">Enter your new password below.</p>
          </div>
          <form className="form" onSubmit={handleResetPassword}>
            <div className="form-field-wrapper">
              <div className="input-group">
                <span className="input-icon material-symbols-outlined">
                  lock
                </span>
                <input
                  className="form-input"
                  placeholder="New Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {passwordError && (
                <p className="validation-message validation-error">
                  {passwordError}
                </p>
              )}
            </div>

            <div className="form-field-wrapper">
              <div className="input-group">
                <span className="input-icon material-symbols-outlined">
                  lock
                </span>
                <input
                  className="form-input"
                  placeholder="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {confirmPasswordError && (
                <p
                  className={`validation-message ${
                    password === confirmPassword && confirmPassword.length > 0
                      ? "validation-success"
                      : "validation-error"
                  }`}
                >
                  {confirmPasswordError}
                </p>
              )}
            </div>

            {error && <p className="error-message">{error}</p>}

            <div>
              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </form>
          <p className="form-footer">
            Remember your password? <a href="/login">Log In</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
