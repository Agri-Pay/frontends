// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./login";
import SignupPage from "./signup";
import DashboardPage from "./dashboard"; // Import Dashboard
import ProtectedRoute from "./protected"; // Import ProtectedRoute
import CreateFarmPage from "./createfarm";
import UploadKmlPage from "./kmlpage";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected Dashboard Route */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-farm"
          element={
            <ProtectedRoute>
              <CreateFarmPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload-kml"
          element={
            <ProtectedRoute>
              <UploadKmlPage />
            </ProtectedRoute>
          }
        />

        {/* Redirect base route to dashboard or login */}
        <Route path="/" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
