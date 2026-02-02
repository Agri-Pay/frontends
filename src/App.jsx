// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./login";
import SignupPage from "./signup";
import ForgotPasswordPage from "./forgotpassword";
import ResetPasswordPage from "./resetpassword";
import DashboardPage from "./fdashboard"; // Import Dashboard
import ProtectedRoute from "./protected"; // Import ProtectedRoute
import CreateFarmPage from "./createfarm";
import UploadKmlPage from "./kmlpage";
import FarmDetailsPage from "./farmdetails";
import FarmsPage from "./farms";
import Dashboard from "./dashboard";
import { Toaster } from "react-hot-toast";
import AdminDashboardPage from "./admindash";
import ReportsPage from "./reports";
import FarmReportsPage from "./farmreports";
import PaymentsPage from "./payments";
import FarmPaymentsPage from "./farmpayments";

function App() {
  return (
    <>
      <Toaster
        position="top-right" // Position it on the top-right of the screen
        toastOptions={{
          // Define default options
          duration: 5000, // Stay on screen for 5 seconds
          style: {
            background: "#334155", // A nice dark color
            color: "#fff",
            borderRadius: "10px",
          },
          // Define styles for success and error toasts
          success: {
            style: {
              background: "#4ade80", // Green for success
              color: "#1e293b",
            },
            iconTheme: {
              primary: "#1e293b",
              secondary: "#4ade80",
            },
          },
          error: {
            style: {
              background: "#f87171", // Red for error
            },
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected Dashboard Route */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farmer-dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-farm"
            element={
              <ProtectedRoute allowedRoles={["farmer"]}>
                <CreateFarmPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload-kml"
            element={
              <ProtectedRoute allowedRoles={["farmer"]}>
                <UploadKmlPage />
              </ProtectedRoute>
            }
          />

          {/* Redirect base route to dashboard or login */}
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/farm/:farmId"
            element={
              <ProtectedRoute>
                <FarmDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/farms"
            element={
              <ProtectedRoute>
                <FarmsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/:farmId"
            element={
              <ProtectedRoute>
                <FarmReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments/:farmId"
            element={
              <ProtectedRoute>
                <FarmPaymentsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
