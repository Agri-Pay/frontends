// src/components/Sidebar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./sidebar.css";
import Notifications from "./notifications";
import { useAuth } from "./useauth";

const Sidebar = () => {
  const location = useLocation();
  const { role } = useAuth();

  // Define navigation items based on user role
  const farmerNavItems = [
    { path: "/home", icon: "home", label: "Dashboard" },
    { path: "/farms", icon: "grass", label: "Farms" },
    { path: "/payments", icon: "payments", label: "Payments" },
    { path: "/reports", icon: "analytics", label: "Reports" },
    { path: "/settings", icon: "settings", label: "Settings" },
  ];

  const adminNavItems = [
    { path: "/home", icon: "home", label: "Dashboard" },
    { path: "/reports", icon: "analytics", label: "Reports" },
    { path: "/settings", icon: "settings", label: "Settings" },
    { path: "/payments", icon: "payments", label: "Payments" },
  ];

  // Select nav items based on role
  const navItems = role === "admin" ? adminNavItems : farmerNavItems;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
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
        <h1 className="logo-text">AgriPay</h1>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${
              location.pathname === item.path ? "active" : ""
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      {/* <div className="sidebar-footer">
        <Link to="/help" className="nav-item">
          <span className="material-symbols-outlined">help</span>
          Help and Support
        </Link>
      </div> */}
      <div className="sidebar-footer">
        <Link to="/help" className="nav-item">
          <span className="material-symbols-outlined">help</span>
          Help and Support
        </Link>
        {/* <Notifications /> Add component here */}
      </div>
    </aside>
  );
};

export default Sidebar;
