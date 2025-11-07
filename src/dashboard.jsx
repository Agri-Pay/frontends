// src/pages/DashboardPage.jsx
import React from "react";
import Sidebar from "./sidebar";
import "./dashboard.css";
import Modal from "./modal";
import { useNavigate } from "react-router-dom";

// src/pages/DashboardPage.jsx
import { useState, useEffect } from "react";
import { supabase } from "./createclient"; // Import supabase client

const DashboardPage = () => {
  // State to hold the user's profile and loading status
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal
  const navigate = useNavigate(); // Hook for navigation

  // useEffect to fetch data when the component mounts
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // 1. Get the current user session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          // 2. Query the 'profiles' table with the user's ID
          const { data, error } = await supabase
            .from("profiles")
            .select("full_name") // We only need the full_name column
            .eq("id", session.user.id) // Match the row to the logged-in user
            .single(); // We expect only one result

          if (error) {
            throw error;
          }

          if (data) {
            // 3. Set the user profile in state
            setUserProfile(data);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error.message);
      } finally {
        // 4. Set loading to false once fetching is complete
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []); // The empty array ensures this effect runs only once on mount

  // Extract the first name from the full_name
  const getFirstName = () => {
    if (!userProfile || !userProfile.full_name) {
      return "User"; // Return a default value if name isn't available
    }
    return userProfile.full_name.split(" ")[0];
  };
  const handleLogout = async () => {
    try {
      // Use Supabase client to sign out
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Redirect the user to the login page
      navigate("/login");
    } catch (error) {
      alert(error.message);
    }
  };

  // Show a loading indicator while fetching data
  if (loading) {
    return (
      <div className="dashboard-container">
        <Sidebar />
        <main className="dashboard-main">
          <div>Loading dashboard...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard</h1>
            {/* Display the fetched first name */}
            <p className="dashboard-subtitle">Welcome back, {getFirstName()}</p>
          </div>
          <div className="header-actions">
            <button
              className="add-farm-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <span className="material-symbols-outlined">add</span>
              Add New Farm
            </button>
            {/* --- NEW LOGOUT BUTTON --- */}
            <button className="logout-btn" onClick={handleLogout}>
              <span className="material-symbols-outlined">logout</span>
              Logout
            </button>
          </div>
        </header>

        {/* The rest of your dashboard content remains the same */}
        <section className="dashboard-section">
          <h2 className="section-title">Farm Summary</h2>
          <div className="summary-cards">
            <div className="summary-card">
              <div>
                <p className="card-label">Total Farms</p>
                <p className="card-value">3</p>
                <p className="card-description">
                  Manage your farms and their details
                </p>
              </div>
              <img
                src="https://via.placeholder.com/100x60"
                alt="Farm landscape"
              />
            </div>
            <div className="summary-card">
              <div>
                <p className="card-label">Total Acreage</p>
                <p className="card-value">150 acres</p>
                <p className="card-description">Total land under cultivation</p>
              </div>
              <img
                src="https://via.placeholder.com/100x60"
                alt="Aerial farm view"
              />
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <h2 className="section-title">Upcoming Milestones</h2>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Farm</th>
                  <th>Milestone</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Green Valley</td>
                  <td>Planting</td>
                  <td>2024-05-15</td>
                  <td>
                    <span className="status-pill in-progress">In Progress</span>
                  </td>
                </tr>
                <tr>
                  <td>Oak Ridge</td>
                  <td>Harvest</td>
                  <td>2024-08-20</td>
                  <td>
                    <span className="status-pill scheduled">Scheduled</span>
                  </td>
                </tr>
                <tr>
                  <td>Sunny Acres</td>
                  <td>Fertilization</td>
                  <td>2024-06-10</td>
                  <td>
                    <span className="status-pill completed">Completed</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-section">
          <h2 className="section-title">Payment Status</h2>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Farm</th>
                  <th>Payment Amount</th>
                  <th>Status</th>
                  <th>Next Payment Date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Green Valley</td>
                  <td>$5,000</td>
                  <td>
                    <span className="status-pill paid">Paid</span>
                  </td>
                  <td>2024-07-15</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="modal-body">
          <h2>How would you like to add your farm?</h2>
          <p>Choose a method to define your farm's boundaries.</p>
          <div className="modal-options">
            <button
              className="modal-option-btn"
              onClick={() => navigate("/create-farm")}
            >
              <span className="material-symbols-outlined">edit</span>
              Draw Polygon on Map
            </button>
            <button
              className="modal-option-btn"
              onClick={() => navigate("/upload-kml")}
            >
              <span className="material-symbols-outlined">upload_file</span>
              Enter Coordinates (KML)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardPage;
