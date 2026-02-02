// src/pages/LoginPage.jsx
import { useState } from "react";
import { supabase } from "./createclient";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "./navbar"; // Import the new Navbar component
import "./login.css";
import { toast } from "react-hot-toast";
const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setError("Invalid login credentials"); // Set a user-friendly message
    } else {
      // alert("Logged in successfully!");
      toast.success("Login Succesful!");
      navigate("/home");
      // navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="login-page-container">
      <Navbar /> {/* Use the reusable Navbar component */}
      <main className="main-content">
        <div className="login-card">
          <div className="card-header">
            <h2 className="card-title">Welcome Back</h2>
            {/* <p className="card-subtitle">Log in to your AgriPay account.</p> */}
          </div>
          <form className="form" onSubmit={handleLogin}>
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
            <div className="input-group">
              <span className="input-icon material-symbols-outlined">lock</span>
              <input
                className="form-input"
                id="password"
                name="password"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-options">
              <div className="remember-me">
                <input
                  className="checkbox"
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                />
                <label htmlFor="remember-me">Remember me</label>
              </div>
              <Link className="forgot-password" to="/forgot-password">
                Forgot password?
              </Link>
            </div>

            {/* The improved error message will appear here */}
            {error && <p className="error-message">{error}</p>}

            <div>
              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? "Logging In..." : "Log In"}
              </button>
            </div>
          </form>
          <p className="form-footer">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
