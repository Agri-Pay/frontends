// src/pages/ForgotPasswordPage.jsx
import { useState } from "react";
import { supabase } from "./createclient";
import { Link } from "react-router-dom";
import Navbar from "./navbar";
import "./login.css";
import { toast } from "react-hot-toast";

const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      toast.error("Failed to send reset email");
    } else {
      setMessage(
        "Password reset link sent! Please check your email inbox (and spam folder)."
      );
      toast.success("Reset email sent!");
    }
    setLoading(false);
  };

  return (
    <div className="login-page-container">
      <Navbar />
      <main className="main-content">
        <div className="login-card">
          <div className="card-header">
            <h2 className="card-title">Forgot Password</h2>
            <p className="card-subtitle">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>
          <form className="form" onSubmit={handleResetPassword}>
            <div className="input-group">
              <span className="input-icon material-symbols-outlined">mail</span>
              <input
                className="form-input"
                id="email"
                name="email"
                placeholder="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <div>
              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </form>
          <p className="form-footer">
            Remember your password? <Link to="/login">Log In</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
