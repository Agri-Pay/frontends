// src/pages/SignupPage.jsx
import { useState, useEffect } from "react";
import { supabase } from "./createclient";
import { Link } from "react-router-dom";
import Navbar from "./navbar";
import "./signup.css";

// src/pages/SignupPage.jsx

const SignupPage = () => {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("farmer");

  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);

  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

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

  const handleSignup = async (event) => {
    event.preventDefault();

    if (passwordError || (confirmPassword && password !== confirmPassword)) {
      setError("Please fix the errors before submitting.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "Registration successful! Please check your email to verify your account."
      );
    }
    setLoading(false);
  };

  return (
    <div className="signup-page-container">
      <Navbar />
      <main className="main-content">
        <div className="signup-card">
          <div className="card-header">
            <h2 className="card-title">Create an Account</h2>
            <p className="card-subtitle">
              Join AgriPay today. It's quick and easy.
            </p>
          </div>

          <form className="form" onSubmit={handleSignup}>
            {/* --- CORRECTED STRUCTURE START --- */}

            {/* Full Name Field */}
            <div className="form-field-wrapper">
              <div className="input-group">
                <span className="input-icon material-symbols-outlined">
                  person
                </span>
                <input
                  className="form-input"
                  placeholder="Full Name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="form-field-wrapper">
              <div className="input-group">
                <span className="input-icon material-symbols-outlined">
                  mail
                </span>
                <input
                  className="form-input"
                  placeholder="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field with Validation Message */}
            <div className="form-field-wrapper">
              <div className="input-group">
                <span className="input-icon material-symbols-outlined">
                  lock
                </span>
                <input
                  className="form-input"
                  placeholder="Password"
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

            {/* Confirm Password Field with Validation Message */}
            <div className="form-field-wrapper">
              <div className="input-group">
                <span className="input-icon material-symbols-outlined">
                  lock
                </span>
                <input
                  className="form-input"
                  placeholder="Confirm Password"
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

            {/* Role Selector */}
            <div className="form-field-wrapper">
              <label htmlFor="role-select" className="input-label">
                I am a:
              </label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-select"
              >
                <option value="farmer">Farmer</option>
                <option value="admin">Admin / Technical Officer</option>
              </select>
            </div>

            {/* --- CORRECTED STRUCTURE END --- */}

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <div>
              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? "Creating Account..." : "Sign Up"}
              </button>
            </div>
          </form>

          <p className="form-footer">
            Already have an account? <Link to="/login">Log In</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignupPage;
