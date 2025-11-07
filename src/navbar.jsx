// src/components/Navbar.jsx
import React from "react";
// Import useLocation along with Link
import { Link, useLocation } from "react-router-dom";
import "./navbar.css";

const Navbar = () => {
  const location = useLocation();

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo-container">
          <div className="logo-svg">
            <svg
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
            </svg>
          </div>
          <h1 className="logo-text">AgroPay</h1>
        </Link>
        <nav className="nav">
          <a className="nav-link" href="#">
            About
          </a>
          <a className="nav-link" href="#">
            Contact
          </a>

          {/* --- DYNAMIC BUTTON LOGIC --- */}
          {/* Check if the current path is '/signup' */}
          {location.pathname === "/signup" ? (
            // If it is, show the Log In button
            <Link to="/login" className="signup-btn">
              Log In
            </Link>
          ) : (
            // Otherwise, show the Sign Up button
            <Link to="/signup" className="signup-btn">
              Sign Up
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
