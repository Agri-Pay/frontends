// src/pages/AdminDashboardPage.jsx
import React, { useState, useEffect } from "react";
// import { Link } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import "./adashboard.css";
import Notifications from "./notifications";
import { useAuth } from "./useauth";
import { Link, useNavigate } from "react-router-dom";
import Spinner from "./spinner";
import { MILESTONE_STATUS, isVerifiedStatus, getStatusDisplay } from "./utils/statusHelpers";

const AdminDashboardPage = () => {
  const [metrics, setMetrics] = useState({
    totalFarms: 0,
    verifiedMilestones: 0,
    paymentsProcessed: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        // Fetch Key Metrics (this part is fine and remains the same)
        const { count: farmCount } = await supabase
          .from("farms")
          .select("*", { count: "exact", head: true });
        const { count: verifiedCount } = await supabase
          .from("cycle_milestones")
          .select("*", { count: "exact", head: true })
          .eq("status", MILESTONE_STATUS.VERIFIED);

        // --- THE FIX IS HERE: Call the RPC function ---
        const { data: activities, error } = await supabase.rpc(
          "get_recent_admin_activities"
        );

        if (error) throw error;

        setMetrics({
          totalFarms: farmCount || 0,
          verifiedMilestones: verifiedCount || 0,
          paymentsProcessed: 0,
        });
        setRecentActivities(activities || []);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="admin-dashboard-container">
      <Sidebar />
      <div className="main-content-wrapper">
        <header className="page-header">
          <div className="header-title">
            <h1>Dashboard</h1>
            <p>
              Overview of farm activities, milestone verifications, and payment
              status.
            </p>
          </div>
          <div className="header-actions">
            <Notifications />
            <div className="user-menu">
              <div className="user-avatar">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-email">{user?.email}</span>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="admin-main">
          {/* <header className="admin-header">
            <h1>Dashboard</h1>
            <p>
              Overview of farm activities, milestone verifications, and payment
              status.
            </p>
          </header> */}

          <section className="metrics-section">
            <h2>Key Metrics</h2>
            <div className="metrics-grid">
              <div className="metric-card">
                <span>Total Farms</span>
                <strong>{metrics.totalFarms}</strong>
              </div>
              <div className="metric-card">
                <span>Milestones Verified</span>
                <strong>{metrics.verifiedMilestones}</strong>
              </div>
              <div className="metric-card">
                <span>Payments Processed</span>
                <strong>{metrics.paymentsProcessed}</strong>
              </div>
            </div>
          </section>

          <section className="activity-section">
            <h2>Recent Activities</h2>
            <div className="activity-table-card">
              <table>
                <thead>
                  <tr>
                    <th>Farm Name</th>
                    <th>Farmer Name</th>
                    <th>Milestone</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.map((activity) => (
                    // Update the keys to match the RPC function's return values
                    <tr key={activity.milestone_id}>
                      <td>{activity.farm_name}</td>
                      <td>{activity.farmer_name}</td>
                      <td>{activity.milestone_name}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            isVerifiedStatus(activity.status) ? "verified" : "pending"
                          }`}
                        >
                          {isVerifiedStatus(activity.status) ? "Verified" : getStatusDisplay(activity.status)}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/farm/${activity.farm_id}`}
                          className="action-link"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
