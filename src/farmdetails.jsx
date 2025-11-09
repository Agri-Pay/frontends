// // src/pages/FarmDetailsPage.jsx
// import React, { useState, useEffect } from "react";
// import { useParams } from "react-router-dom";
// import { supabase } from "./createclient";
// import Sidebar from "./sidebar";
// import {
//   getWeatherForPolygon,
//   getSoilDataForPolygon,
//   getNdviHistoryForPolygon,
//   searchSatelliteImages,
// } from "./agromonitoring";

// // Import Chart.js components
// import { Line } from "react-chartjs-2";
// import {
//   Chart as ChartJS,
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend,
// } from "chart.js";

// import "./farmdetails.css";

// // Register Chart.js components
// ChartJS.register(
//   CategoryScale,
//   LinearScale,
//   PointElement,
//   LineElement,
//   Title,
//   Tooltip,
//   Legend
// );

// // NDVI Chart Component
// const NdviChart = ({ data }) => {
//   const chartData = {
//     labels: data.map((item) => new Date(item.dt * 1000).toLocaleDateString()),
//     datasets: [
//       {
//         label: "Mean NDVI",
//         data: data.map((item) => item.data.mean),
//         borderColor: "#4cdf20",
//         backgroundColor: "rgba(76, 223, 32, 0.2)",
//         fill: true,
//       },
//     ],
//   };
//   const options = { responsive: true, plugins: { legend: { display: false } } };
//   return <Line options={options} data={chartData} />;
// };

// const FarmDetailsPage = () => {
//   const { farmId } = useParams();
//   const [farm, setFarm] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   // State for all our new data
//   const [weather, setWeather] = useState(null);
//   const [soil, setSoil] = useState(null);
//   const [ndviHistory, setNdviHistory] = useState([]);
//   const [latestImage, setLatestImage] = useState(null);
//   const [imageType, setImageType] = useState("tci"); // 'tci' or 'ndvi'

//   useEffect(() => {
//     const fetchAllData = async () => {
//       try {
//         // 1. Get farm details from our database (this includes the agromonitoring_id)
//         const { data: farmData, error: farmError } = await supabase
//           .from("farms")
//           .select("*")
//           .eq("id", farmId)
//           .single();
//         if (farmError) throw farmError;
//         setFarm(farmData);

//         if (!farmData.agromonitoring_id) {
//           throw new Error(
//             "This farm is not registered with the monitoring service."
//           );
//         }

//         const polyId = farmData.agromonitoring_id;

//         // 2. Fetch all AgroMonitoring data in parallel for speed
//         const [weatherData, soilData, ndviData, imageData] = await Promise.all([
//           getWeatherForPolygon(polyId),
//           getSoilDataForPolygon(polyId),
//           getNdviHistoryForPolygon(polyId),
//           searchSatelliteImages(polyId),
//         ]);

//         setWeather(weatherData);
//         setSoil(soilData);
//         setNdviHistory(ndviData);
//         setLatestImage(imageData);
//       } catch (err) {
//         setError(err.message);
//         console.error("Error fetching farm data:", err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchAllData();
//   }, [farmId]);

//   const getImageUrl = () => {
//     if (!latestImage) return null;
//     return imageType === "tci" ? latestImage.image.tci : latestImage.image.ndvi;
//   };

//   if (loading) {
//     return (
//       <div className="farm-details-container">
//         <Sidebar />
//         <main className="farm-details-main loading-state">
//           Loading farm details...
//         </main>
//       </div>
//     );
//   }
//   if (error) {
//     return (
//       <div className="farm-details-container">
//         <Sidebar />
//         <main className="farm-details-main error-state">Error: {error}</main>
//       </div>
//     );
//   }

//   return (
//     <div className="farm-details-container">
//       <Sidebar />
//       <main className="farm-details-main">
//         <h1 className="farm-name-title">{farm?.name}</h1>

//         <div className="data-grid">
//           {/* Weather Card */}
//           <div className="data-card weather-card">
//             <h3>Current Weather</h3>
//             {weather ? (
//               <div className="weather-content">
//                 <img
//                   src={`http://openweathermap.org/img/wn/${weather[0].weather[0].icon}@2x.png`}
//                   alt="weather icon"
//                 />
//                 <div className="weather-details">
//                   <p className="temperature">
//                     {Math.round(weather[0].main.temp - 273.15)}°C
//                   </p>
//                   <p className="description">
//                     {weather[0].weather[0].description}
//                   </p>
//                 </div>
//               </div>
//             ) : (
//               <p>Loading weather...</p>
//             )}
//           </div>

//           {/* Soil Data Card */}
//           <div className="data-card soil-card">
//             <h3>Soil Data</h3>
//             {soil ? (
//               <div className="soil-content">
//                 <p>Temperature: {Math.round(soil.t10 - 273.15)}°C</p>
//                 <p>Moisture: {(soil.moisture * 100).toFixed(1)}%</p>
//               </div>
//             ) : (
//               <p>Loading soil data...</p>
//             )}
//           </div>

//           {/* NDVI Chart */}
//           <div className="data-card chart-card">
//             <h3>NDVI Trend (30 Days)</h3>
//             {ndviHistory.length > 0 ? (
//               <NdviChart data={ndviHistory} />
//             ) : (
//               <p>No NDVI data available.</p>
//             )}
//           </div>

//           {/* Satellite Image Card */}
//           <div className="data-card image-card">
//             <div className="image-header">
//               <h3>Latest Satellite Image</h3>
//               <div className="image-toggle">
//                 <button
//                   onClick={() => setImageType("tci")}
//                   className={imageType === "tci" ? "active" : ""}
//                 >
//                   True Color
//                 </button>
//                 <button
//                   onClick={() => setImageType("ndvi")}
//                   className={imageType === "ndvi" ? "active" : ""}
//                 >
//                   NDVI
//                 </button>
//               </div>
//             </div>
//             {latestImage ? (
//               <img
//                 src={getImageUrl()}
//                 alt={`${imageType} view`}
//                 className="satellite-image"
//               />
//             ) : (
//               <p>No recent satellite imagery found.</p>
//             )}
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default FarmDetailsPage;

// src/pages/FarmDetailsPage.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import Modal from "./modal";
import ConfirmDialog from "./confirmdialog";
import {
  getWeatherForPolygon,
  getSoilDataForPolygon,
  getNdviHistoryForPolygon,
  searchSatelliteImages,
} from "./agromonitoring";
import { toast } from "react-hot-toast";

// Import Chart.js components
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import "./farmdetails.css";
import { useAuth } from "./useauth";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
import Spinner from "./spinner";
// NDVI Chart Component
const NdviChart = ({ data }) => {
  const chartData = {
    labels: data.map((item) => new Date(item.dt * 1000).toLocaleDateString()),
    datasets: [
      {
        label: "Mean NDVI",
        data: data.map((item) => item.data.mean),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };
  const options = { responsive: true, plugins: { legend: { display: false } } };
  return <Line options={options} data={chartData} />;
};

const FarmDetailsPage = () => {
  const { farmId } = useParams();
  const { role, loading: authLoading } = useAuth();
  const [farm, setFarm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [weather, setWeather] = useState(null);
  const [soil, setSoil] = useState(null);
  const [ndviHistory, setNdviHistory] = useState([]);
  const [latestImage, setLatestImage] = useState(null);
  const [imageType, setImageType] = useState("tci");
  const [activeCycle, setActiveCycle] = useState(null);
  const [cycleMilestones, setCycleMilestones] = useState([]);
  const [availableCrops, setAvailableCrops] = useState([]);

  // Modal state for starting a cycle
  const [isStartCycleModalOpen, setIsStartCycleModalOpen] = useState(false);
  const [selectedCropId, setSelectedCropId] = useState("");
  
  // Confirmation dialog state for milestone verification
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [milestoneToVerify, setMilestoneToVerify] = useState(null);

  useEffect(() => {
    const fetchFarmData = async () => {
      setLoading(true);
      setError("");
      try {
        // --- Part 1: Fetch core farm data and available crops ---
        const { data: farmData, error: farmError } = await supabase
          .from("farms")
          .select("*")
          .eq("id", farmId)
          .single();
        if (farmError) throw farmError;
        setFarm(farmData);

        const { data: crops } = await supabase.from("crops").select("*");
        if (crops) {
          setAvailableCrops(crops);
          if (crops.length > 0) setSelectedCropId(crops[0].id);
        }

        // --- Part 2: Check for an active crop cycle (this remains the same) ---
        const { data: cycleData, error: cycleError } = await supabase
          .from("crop_cycles")
          .select(`*, cycle_milestones(*, milestone_templates(*))`)
          .eq("farm_id", farmId)
          .eq("is_active", true);
        if (cycleError) throw cycleError;

        if (cycleData && cycleData.length === 1) {
          const currentCycle = cycleData[0];
          setActiveCycle(currentCycle);
          const sortedMilestones = currentCycle.cycle_milestones.sort(
            (a, b) =>
              a.milestone_templates.sequence - b.milestone_templates.sequence
          );
          setCycleMilestones(sortedMilestones);
        } else {
          setActiveCycle(null);
          setCycleMilestones([]);
        }

        // --- THE FIX IS HERE ---
        // Part 3: Fetch AgroMonitoring data regardless of active cycle, as long as the farm is registered.
        if (farmData && farmData.agromonitoring_id) {
          const polyId = farmData.agromonitoring_id;

          // Use Promise.allSettled to prevent one failed request from stopping all others
          const results = await Promise.allSettled([
            getWeatherForPolygon(polyId),
            getSoilDataForPolygon(polyId),
            getNdviHistoryForPolygon(polyId),
            searchSatelliteImages(polyId),
          ]);

          // Assign data if the request was successful
          if (results[0].status === "fulfilled") {
            console.log("Weather data fetched successfully");
            setWeather(results[0].value);
          }
          if (results[1].status === "fulfilled") {
            console.log("Soil data fetched successfully");
            setSoil(results[1].value);
          }
          if (results[2].status === "fulfilled") {
            console.log("NDVI data fetched successfully");
            setNdviHistory(results[2].value);
          }
          if (results[3].status === "fulfilled") {
            console.log("Satellite images fetched successfully");
            setLatestImage(results[3].value);
          }

          // Log any errors without crashing the page
          const failedRequests = [];
          results.forEach((result, index) => {
            if (result.status === "rejected") {
              const apiNames = ["Weather", "Soil", "NDVI", "Satellite Images"];
              console.error(
                `Failed to fetch ${apiNames[index]} data:`,
                result.reason
              );
              failedRequests.push(apiNames[index]);
            }
          });
          
          // Show toast notification if some API calls failed
          if (failedRequests.length > 0) {
            toast.error(`Failed to fetch: ${failedRequests.join(", ")}`);
          }
        } else {
          // If the farm isn't registered with AgroMonitoring, we can't fetch this data.
          console.warn(
            "Farm is not registered with AgroMonitoring service. Skipping data fetch."
          );
        }
        // --- END OF FIX ---
      } catch (error) {
        setError(error.message);
        console.error("Error fetching page data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFarmData();
  }, [farmId]);

  const getImageUrl = () => {
    if (!latestImage) return null;
    return imageType === "tci" ? latestImage.image.tci : latestImage.image.ndvi;
  };
  const handleApproveClick = (milestone) => {
    setMilestoneToVerify(milestone);
    setShowConfirmDialog(true);
  };

  const handleConfirmApprove = async () => {
    if (!milestoneToVerify) return;

    const { error } = await supabase
      .from("cycle_milestones")
      .update({ is_verified: true })
      .eq("id", milestoneToVerify.id);

    if (error) {
      toast.error("Error updating verification");
    } else {
      toast.success("Milestone approved successfully");
      // Update local state for instant UI feedback
      setCycleMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneToVerify.id ? { ...m, is_verified: true } : m
        )
      );
    }
    setMilestoneToVerify(null);
  };
  const handleStartCycle = async () => {
    if (!selectedCropId) {
      // alert("Please select a crop.");
      toast.error("No Crop Selected");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("start-crop-cycle", {
        body: { farm_id: farmId, crop_id: selectedCropId },
      });
      if (error) throw error;
      // alert("Crop cycle started successfully!");
      toast.success("Cycle Started Succesfully");
      window.location.reload(); // Easiest way to refresh all data
    } catch (error) {
      // alert("Error starting cycle: " + error.message);
      toast.error("Error starting cycle");
    }
  };
  const handleStatusChange = async (milestoneId, newStatus) => {
    const { error } = await supabase
      .from("cycle_milestones")
      .update({ status: newStatus })
      .eq("id", milestoneId);
    if (error) {
      // alert(error.message);
      toast.error(error.message);
    } else {
      // Update local state for instant UI feedback
      setCycleMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId ? { ...m, status: newStatus } : m
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main loading-state">
          Loading farm details...
        </main>
        <Spinner></Spinner>
      </div>
    );
  }
  if (error) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main error-state">Error: {error}</main>
      </div>
    );
  }

  //   const getImageUrl = () => {
  //     // ... (This function remains exactly the same)
  //   };

  // Improved Loading and Error states
  if (loading) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main state-container">
          <div className="loader"></div>
          <p>Fetching farm data...</p>
          <Spinner></Spinner>
        </main>
      </div>
    );
  }
  if (error) {
    return (
      <div className="farm-details-container">
        <Sidebar />
        <main className="farm-details-main state-container">
          <span className="material-symbols-outlined error-icon">error</span>
          <p>Error: {error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="farm-details-container">
      <Sidebar />
      <main className="farm-details-main">
        <div className="page-title-section">
          <h1 className="farm-name-title">{farm?.name}</h1>
          <p className="farm-subtitle">
            Live farm metrics and satellite imagery
          </p>
        </div>
        {activeCycle ? (
          // --- MILESTONE VIEW ---
          <div className="milestone-section">
            <h2>
              Ongoing Cycle:{" "}
              {availableCrops.find((c) => c.id === activeCycle.crop_id)?.name}
            </h2>
            <div className="milestone-list">
              {cycleMilestones.map((ms) => (
                <div key={ms.id} className="milestone-item">
                  <div className="milestone-info">
                    <h4>{ms.milestone_templates.name}</h4>
                    <p>{ms.milestone_templates.description}</p>
                  </div>
                  <div className="milestone-status">
                    {role === "admin" ? (
                      // UI for Admin (Technical Officer)
                      <>
                        <span
                          className={`status-pill role-view ${ms.status
                            .toLowerCase()
                            .replace(" ", "-")}`}
                        >
                          {ms.status}
                        </span>
                        {!ms.is_verified ? (
                          <button
                            onClick={() => handleApproveClick(ms)}
                            className="verify-btn verify"
                            disabled={ms.status !== "Completed"} // Only allow verification if farmer marked it complete
                          >
                            Verify
                          </button>
                        ) : (
                          <span className="verified-locked">
                            <span className="material-symbols-outlined">lock</span>
                            Verified (Locked)
                          </span>
                        )}
                      </>
                    ) : (
                      // UI for Farmer
                      <>
                        <select
                          value={ms.status}
                          onChange={(e) =>
                            handleStatusChange(ms.id, e.target.value)
                          }
                        >
                          <option>Not Started</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                        </select>
                        <span
                          className={`verified-badge ${
                            ms.is_verified ? "verified" : ""
                          }`}
                        >
                          {ms.is_verified ? "Verified" : "Not Verified"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // --- START CYCLE VIEW ---
          role === "farmer" && (
            <div className="start-cycle-card">
              <h3>No Active Crop Cycle</h3>
              <p>
                Start a new cycle to begin tracking milestones for this farm.
              </p>
              <button
                className="start-btn"
                onClick={() => setIsStartCycleModalOpen(true)}
              >
                Start New Crop Cycle
              </button>
            </div>
          )
        )}

        <div className="data-grid">
          {/* Weather Card */}
          <div className="data-card weather-card">
            <h3>Live Weather</h3>
            {weather && weather.length > 0 ? (
              <div className="weather-content">
                <img
                  src={`http://openweathermap.org/img/wn/${weather[0].weather[0].icon}@4x.png`}
                  alt="weather icon"
                />
                <div className="weather-details">
                  <p className="temperature">
                    {Math.round(weather[0].main.temp - 273.15)}°C
                  </p>
                  <p className="description">
                    {weather[0].weather[0].description}
                  </p>
                </div>
              </div>
            ) : loading ? (
              <p>Loading weather...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Weather data unavailable. Check console for details.
              </p>
            )}
          </div>

          {/* Soil Data Card */}
          <div className="data-card soil-card">
            <h3>Live Soil Data</h3>
            {soil ? (
              <div className="soil-content">
                <div className="metric-item">
                  <span className="material-symbols-outlined metric-icon">
                    device_thermostat
                  </span>
                  <div>
                    <p className="metric-label">Temperature (10cm)</p>
                    <p className="metric-value">
                      {Math.round(soil.t10 - 273.15)}°C
                    </p>
                  </div>
                </div>
                <div className="metric-item">
                  <span className="material-symbols-outlined metric-icon">
                    water_drop
                  </span>
                  <div>
                    <p className="metric-label">Moisture</p>
                    <p className="metric-value">
                      {(soil.moisture * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <p>Loading soil data...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                Soil data unavailable. Check console for details.
              </p>
            )}
          </div>

          {/* NDVI Chart */}
          <div className="data-card chart-card">
            <h3>NDVI Trend (Last 30 Days)</h3>
            <p className="card-subtitle">
              Higher values indicate healthier vegetation
            </p>
            {ndviHistory.length > 0 ? (
              <div className="chart-container">
                <NdviChart data={ndviHistory} />
              </div>
            ) : loading ? (
              <p>Loading NDVI data...</p>
            ) : (
              <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
                No NDVI data available. Check console for details.
              </p>
            )}
          </div>

          {/* Satellite Image Card */}
          {/* <div className="data-card image-card">
            <div className="image-header">
              <h3>Latest Satellite Image</h3>
              <div className="image-toggle">
                <button
                  onClick={() => setImageType("tci")}
                  className={imageType === "tci" ? "active" : ""}
                >
                  True Color
                </button>
                <button
                  onClick={() => setImageType("ndvi")}
                  className={imageType === "ndvi" ? "active" : ""}
                >
                  NDVI
                </button>
              </div>
            </div>
            {latestImage ? (
              <img
                src={getImageUrl()}
                alt={`${imageType} view`}
                className="satellite-image"
              />
            ) : (
              <div className="satellite-placeholder">
                <span className="material-symbols-outlined">satellite_alt</span>
                <p>No recent satellite imagery found.</p>
              </div>
            )}
          </div> */}
        </div>
      </main>
      <Modal
        isOpen={isStartCycleModalOpen}
        onClose={() => setIsStartCycleModalOpen(false)}
      >
        <div className="start-cycle-modal">
          <h2>Start a New Crop Cycle</h2>
          <div className="crop-selector">
            <label htmlFor="crop-select">Select a Crop:</label>
            <div className="select-wrapper">
              <select
                id="crop-select"
                value={selectedCropId}
                onChange={(e) => setSelectedCropId(e.target.value)}
              >
                {availableCrops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="modal-start-btn" onClick={handleStartCycle}>
              Start Cycle
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setMilestoneToVerify(null);
        }}
        onConfirm={handleConfirmApprove}
        type="success"
        title="Approve Milestone Verification?"
        confirmText="Approve & Release Payment"
        cancelText="Cancel"
      >
        {milestoneToVerify && (
          <div className="confirm-dialog-details">
            <p className="confirm-milestone-name">
              <strong>{milestoneToVerify.milestone_templates?.name || "Milestone"}</strong>
              {" - "}
              {milestoneToVerify.crop_cycles?.crops?.name || "Crop"}
            </p>
            <div className="confirm-warning-box">
              <span className="material-symbols-outlined">info</span>
              <div>
                <strong className="confirm-warning-title">Warning: This action is irreversible</strong>
                <p className="confirm-warning-text">
                  Once approved, payment will be released to the farmer via blockchain smart contract. 
                  This transaction cannot be reversed or cancelled.
                </p>
              </div>
            </div>
            <div className="confirm-checklist">
              <label className="confirm-checkbox">
                <input type="checkbox" required />
                I have reviewed the milestone completion evidence
              </label>
              <label className="confirm-checkbox">
                <input type="checkbox" required />
                I have verified the agricultural data and metrics
              </label>
              <label className="confirm-checkbox">
                <input type="checkbox" required />
                I confirm this milestone meets all required criteria
              </label>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default FarmDetailsPage;
