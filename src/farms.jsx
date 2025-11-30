// src/pages/FarmsPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import "./farms.css";
import Spinner from "./spinner";
import { toast } from "react-hot-toast";
import { useAuth } from "./useauth";
import { getMapboxStaticImageUrl } from "./utils/geometryHelpers";

// This is the new, self-contained Farm Card component
const FarmCard = ({ farm }) => {
  const navigate = useNavigate();
  const mapboxApiKey = import.meta.env.VITE_MAPBOX_API_KEY;

  // Debug logging
  console.log("Farm data:", farm.name, {
    boundary_geojson: farm.boundary_geojson,
    hasMapboxKey: !!mapboxApiKey
  });

  // Get area - use stored value from database
  const area = farm.area_hectares?.toFixed(2) || '0.00';

  // Get map image URL from boundary GeoJSON
  let imageUrl = "https://via.placeholder.com/350x150?text=No+Boundary+Data";
  
  if (farm.boundary_geojson) {
    // boundary_geojson from ST_AsGeoJSON is a geometry object, not a full GeoJSON
    // It might be a string that needs parsing, or already an object
    let boundaryGeometry = farm.boundary_geojson;
    if (typeof boundaryGeometry === 'string') {
      try {
        boundaryGeometry = JSON.parse(boundaryGeometry);
      } catch (e) {
        console.error("Failed to parse boundary_geojson:", e);
      }
    }
    
    if (boundaryGeometry && mapboxApiKey) {
      imageUrl = getMapboxStaticImageUrl(boundaryGeometry, mapboxApiKey);
    } else if (!mapboxApiKey) {
      imageUrl = "https://via.placeholder.com/350x150?text=Mapbox+Key+Missing";
    }
  }

  const milestonesComplete = 0; // Placeholder data
  const totalMilestones = 5; // Placeholder data
  const progress = (milestonesComplete / totalMilestones) * 100;

  return (
    <div className="farm-card">
      <img src={imageUrl} alt={`Map of ${farm.name}`} className="card-image" />
      <div className="card-content">
        <div className="card-header">
          <h3>{farm.name}</h3>
          <button
            onClick={() => navigate(`/farm/${farm.id}`)}
            className="view-details-btn"
          >
            View Details
          </button>
        </div>
        <div className="card-details">
          <p>Total Area: {area} Hectares</p>
          <p>
            {milestonesComplete} of {totalMilestones} milestones complete
          </p>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FarmsPage = () => {
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { role } = useAuth();

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        // Attempt to use RPC to get farms with boundary as GeoJSON
        // This handles the PostGIS geometry conversion server-side
        const { data, error } = await supabase.rpc('get_user_farms_geojson');
        
        if (error) {
          // Fallback: If RPC doesn't exist yet, use basic query
          // Note: This won't include boundary GeoJSON for map images
          console.warn("RPC not available, using fallback query:", error.message);
          const { data: fallbackData, error: fallbackError } = await supabase
            .from("farms")
            .select("id, name, area_hectares");
          
          if (fallbackError) {
            console.error("Error fetching farms:", fallbackError);
            toast.error("Failed to load farms");
          } else {
            // Map to expected format (without boundary_geojson)
            setFarms(fallbackData?.map(f => ({
              ...f,
              boundary_geojson: null
            })) || []);
          }
        } else {
          setFarms(data || []);
        }
      } catch (err) {
        console.error("Error fetching farms:", err);
        toast.error("Failed to load farms");
      } finally {
        setLoading(false);
      }
    };
    fetchFarms();
  }, []);

  if (loading) return <Spinner></Spinner>;

  return (
    <div className="farms-page-container">
      <Sidebar />
      <main className="farms-main">
        <header className="farms-page-header">
          <div>
            <h1>My Farms</h1>
            <p className="page-subtitle">
              An overview of all your registered farms.
            </p>
          </div>
          <div className="search-bar">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search by farm name..." />
          </div>
        </header>

        <div className="farms-grid">
          {farms.map((farm) => (
            <FarmCard key={farm.id} farm={farm} />
          ))}
          {/* "Add New Farm" card - Only visible to farmers */}
          {role === "farmer" && (
            <div
              className="add-farm-card"
              onClick={() => navigate("/create-farm")}
            >
              <div className="add-icon-circle">
                <span className="material-symbols-outlined">add</span>
              </div>
              <h3>Have another property?</h3>
              <button className="add-farm-cta">Add a New Farm</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FarmsPage;
