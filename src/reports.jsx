// src/pages/ReportsPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import { area as turfArea } from "@turf/area";
import { polygon as turfPolygon } from "@turf/helpers";
import "./reports.css";
import Spinner from "./spinner";
import { useAuth } from "./useauth";

// Report Farm Card Component - Similar to FarmCard but with "View Reports" button
const ReportFarmCard = ({ farm }) => {
  const navigate = useNavigate();
  const mapboxApiKey = import.meta.env.VITE_MAPBOX_API_KEY;

  // Calculate area in hectares (1 hectare = 10,000 sq meters)
  const getAreaInHectares = (locationData) => {
    if (!locationData) return 0;
    const coords = locationData.map((p) => [p.lng, p.lat]);
    if (coords.length < 3) return 0;
    if (
      coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]
    ) {
      coords.push(coords[0]);
    }
    const poly = turfPolygon([coords]);
    const areaInMeters = turfArea(poly);
    return (areaInMeters / 10000).toFixed(2);
  };

  // Construct Mapbox Static Image URL
  const getMapImageUrl = (locationData) => {
    if (!locationData || !mapboxApiKey) {
      return "https://via.placeholder.com/350x150?text=Map+Preview+Unavailable";
    }
    const coords = locationData.map((p) => [p.lng, p.lat]);
    if (coords.length < 3)
      return "https://via.placeholder.com/350x150?text=Invalid+Polygon";
    if (
      coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]
    ) {
      coords.push(coords[0]);
    }
    const geoJson = turfPolygon([coords]);
    const encodedGeoJson = encodeURIComponent(JSON.stringify(geoJson.geometry));

    return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/geojson(${encodedGeoJson})/auto/350x150?padding=20&access_token=${mapboxApiKey}`;
  };

  const area = getAreaInHectares(farm.location_data);
  const imageUrl = getMapImageUrl(farm.location_data);
  
  // Mock report count for now - can be calculated from actual data later
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
            location_data,
            user_id
          `);

        // Role-based filtering: farmer sees only their farms, admin sees all
        if (role === "farmer") {
          query = query.eq("user_id", user.id);
        }

        const { data: farmsData, error: farmsError } = await query;
        
        if (farmsError) throw farmsError;

        // For each farm, count completed milestones (these would be reports)
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

            // Count completed milestones across all cycles for this farm
            const { count, error } = await supabase
              .from("cycle_milestones")
              .select("*", { count: "exact", head: true })
              .in("cycle_id", cycles.map(c => c.id))
              .eq("status", "Completed");

            return {
              ...farm,
              report_count: error ? 0 : (count || 0)
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
