// src/pages/CreateFarmPage.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import { supabase } from "./createclient";
import "./createfarm.css";
import { registerPolygonWithAgro } from "./agromonitoring";
import Spinner from "./spinner";
import { toast } from "react-hot-toast";
import { useAuth } from "./useauth";

// Minimal header for this page
const MinimalHeader = () => (
  <header className="minimal-header">
    <div className="header-content">
      <div className="logo-container">
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
      <nav className="minimal-nav">
        <a href="/home">Dashboard</a>
        <a href="/farms" className="active">
          Farms
        </a>
        <a href="/payments">Payments</a>
        <a href="/reports">Reports</a>
      </nav>
      <div className="profile-icon"></div>
    </div>
  </header>
);

const CreateFarmPage = () => {
  const [farmName, setFarmName] = useState("");
  const [polygonCoords, setPolygonCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const { role, loading: authLoading } = useAuth();

  // Role protection: Only farmers can create farms
  useEffect(() => {
    if (!authLoading && role === "admin") {
      toast.error("Admins cannot create farms");
      navigate("/admin-dashboard");
    }
  }, [role, authLoading, navigate]);
  const handleCreated = (e) => {
    const { layerType, layer } = e;
    if (layerType === "polygon") {
      const latlngs = layer.getLatLngs()[0]; // Get coordinates
      setPolygonCoords(latlngs);
    }
  };

  const handleSaveFarm = async () => {
    setError("");
    if (!farmName.trim()) {
      setError("Please provide a name for your farm.");
      return;
    }
    if (!polygonCoords) {
      setError("Please draw the boundaries of your farm on the map.");
      return;
    }

    setLoading(true);

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found.");

      // 1. Insert the farm into our database and get the new record back
      const { data: newFarm, error: insertError } = await supabase
        .from("farms")
        .insert([
          { user_id: user.id, name: farmName, location_data: polygonCoords },
        ])
        .select() // IMPORTANT: select() returns the inserted row
        .single();

      if (insertError) throw insertError;
      if (!newFarm) throw new Error("Failed to create farm in database.");

      // 2. Register the polygon with AgroMonitoring
      const agroId = await registerPolygonWithAgro(
        newFarm.name,
        newFarm.location_data
      );

      // 3. Update our farm record with the new AgroMonitoring ID
      const { error: updateError } = await supabase
        .from("farms")
        .update({ agromonitoring_id: agroId })
        .eq("id", newFarm.id);

      if (updateError) throw updateError;

      // alert("Farm saved and registered successfully!");
      toast.success("From saved and registered!");
      navigate("/home");
    } catch (error) {
      setError(error.message);
      console.error("Error saving farm:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
          searchQuery
        )}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const map = mapRef.current;
        if (map) {
          map.setView([lat, lon], 13); // Fly to the location with zoom level 13
        }
      } else {
        // alert("Location not found. Please try a different search term.");
        toast.error("Location not found!");
      }
    } catch (error) {
      console.error("Error during geocoding search:", error);
      // alert("Could not perform search. Please check your connection.");
      toast.error("Could not peform search");
    }
  };

  return (
    <div className="create-farm-container">
      <MinimalHeader />
      <main className="create-farm-main">
        <div className="form-header">
          <h1>Create New Farm</h1>
          <p>Draw the boundaries of your farm on the map below.</p>
        </div>

        {/* Updated form controls with search */}
        <div className="form-controls">
          <input
            type="text"
            className="farm-name-input"
            placeholder="Enter farm name (e.g., Green Valley)"
            value={farmName}
            onChange={(e) => setFarmName(e.target.value)}
          />
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <span className="material-symbols-outlined">search</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search for a city or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className="map-wrapper">
          {/* Added ref to the MapContainer */}
          <MapContainer
            ref={mapRef}
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <FeatureGroup>
              <EditControl
                position="topright"
                onCreated={handleCreated}
                draw={{
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  polyline: false,
                }}
                edit={{ edit: false, remove: true }}
              />
            </FeatureGroup>
          </MapContainer>
        </div>
        {error && <p className="error-message-farm">{error}</p>}
      </main>
      <footer className="create-farm-footer">
        <button className="cancel-btn" onClick={() => navigate("/home")}>
          Cancel
        </button>
        <button
          className="save-btn"
          onClick={handleSaveFarm}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Farm"}
        </button>
      </footer>
    </div>
  );
};

export default CreateFarmPage;
