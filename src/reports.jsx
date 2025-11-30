// src/pages/ReportsPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import "./reports.css";
import Spinner from "./spinner";
import { useAuth } from "./useauth";
import { geoJSONToMapboxURL } from "./utils/geometryHelpers";
import { isCompletedStatus } from "./utils/statusHelpers";

// Report Farm Card Component - Similar to FarmCard but with "View Reports" button
const ReportFarmCard = ({ farm }) => {
  const navigate = useNavigate();
  const mapboxApiKey = import.meta.env.VITE_MAPBOX_API_KEY;

  // Get area - prefer stored area_hectares, fallback to location data calculation
  const getAreaInHectares = () => {
    // Use pre-calculated area from database
    if (farm.area_hectares) {
      return parseFloat(farm.area_hectares).toFixed(2);
    }
    return "0.00";
  };

  // Construct Mapbox Static Image URL from PostGIS boundary
  const getMapImageUrl = () => {
    if (!mapboxApiKey) {
      return "https://via.placeholder.com/350x150?text=Map+Preview+Unavailable";
    }
    
    if (farm.boundary) {
      try {
        const geojson = typeof farm.boundary === 'string' ? JSON.parse(farm.boundary) : farm.boundary;
        return geoJSONToMapboxURL(geojson, mapboxApiKey);
      } catch (e) {
        console.warn('Failed to parse boundary GeoJSON:', e);
      }
    }
    
    return "https://via.placeholder.com/350x150?text=No+Boundary+Data";
  };

  const area = getAreaInHectares();
  const imageUrl = getMapImageUrl();
  
  // Report count from data
  const reportCount = farm.report_count || 0;

  return (
    <div className="report-farm-card">
      <img src={imageUrl} alt={`Map of ${farm.name}`} className="card-image" />
      <div className="card-content">
        <div className="card-header">
          <h3>{farm.name}</h3>
          {reportCount > 0 && (
            <span className="report-count-badge">{reportCount} reports</span>
          )}
        </div>
        <div className="card-details">
          <p>Total Area: {area} Hectares</p>
          <p className="report-status-text">
            {reportCount > 0 
              ? `${reportCount} verification report${reportCount > 1 ? 's' : ''} available`
              : 'No reports yet'}
          </p>
          <button
            onClick={() => navigate(`/reports/${farm.id}`)}
            className="view-reports-btn"
          >
            <span className="material-symbols-outlined">analytics</span>
            View Reports
          </button>
        </div>
      </div>
    </div>
  );
};

const ReportsPage = () => {
  const { user, role, loading: authLoading } = useAuth();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchFarms = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Base query for farms
        let query = supabase
          .from("farms")
          .select(`
            id, 
            name, 
            area_hectares,
            boundary,
            user_id
          `);

        // Role-based filtering: farmer sees only their farms, admin sees all
        if (role === "farmer") {
          query = query.eq("user_id", user.id);
        }

        const { data: farmsData, error: farmsError } = await query;
        
        if (farmsError) throw farmsError;

        // For each farm, count completed/verified milestones (these would be reports)
        const farmsWithReportCounts = await Promise.all(
          (farmsData || []).map(async (farm) => {
            // First get the crop cycles for this farm
            const { data: cycles } = await supabase
              .from("crop_cycles")
              .select("id")
              .eq("farm_id", farm.id);

            if (!cycles || cycles.length === 0) {
              return {
                ...farm,
                report_count: 0
              };
            }

            // Get all milestones for these cycles
            const { data: milestones, error } = await supabase
              .from("cycle_milestones")
              .select("status")
              .in("cycle_id", cycles.map(c => c.id));

            // Count milestones that are completed (using helper for both old and new status values)
            const completedCount = milestones 
              ? milestones.filter(m => isCompletedStatus(m.status)).length 
              : 0;

            return {
              ...farm,
              report_count: error ? 0 : completedCount
            };
          })
        );

        setFarms(farmsWithReportCounts);
      } catch (error) {
        console.error("Error fetching farms:", error);
        setFarms([]);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchFarms();
    }
  }, [user, role, authLoading]);

  // Filter farms based on search query
  const filteredFarms = farms.filter((farm) =>
    farm.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || loading) {
    return <Spinner />;
  }

  return (
    <div className="reports-page-container">
      <Sidebar />
      <main className="reports-main">
        <header className="reports-page-header">
          <div>
            <h1>Verification Reports</h1>
            <p className="page-subtitle">
              Review AI-generated milestone verification reports for all farms
            </p>
          </div>
          <div className="search-bar">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Search by farm name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <div className="reports-grid">
          {filteredFarms.length === 0 ? (
            <div className="no-reports-message">
              <span className="material-symbols-outlined">analytics</span>
              <h3>No Farms Found</h3>
              <p>
                {searchQuery
                  ? "No farms match your search. Try a different search term."
                  : "No farms available. Add a farm to start generating verification reports."}
              </p>
            </div>
          ) : (
            filteredFarms.map((farm) => (
              <ReportFarmCard key={farm.id} farm={farm} />
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default ReportsPage;
