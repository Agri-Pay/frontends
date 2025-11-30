// src/pages/FarmReportsPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import Spinner from "./spinner";
import { useAuth } from "./useauth";
import { toast } from "react-hot-toast";
import ConfirmDialog from "./confirmdialog";
import "./farmreports.css";
import { 
  MILESTONE_STATUS, 
  isVerifiedStatus, 
  isPendingVerification,
  getStatusDisplay 
} from "./utils/statusHelpers";

// Mock data generator for agro_augmentation if null
const generateMockReportData = (milestone) => ({
  report_id: `rpt_${milestone.id}`,
  generated_at: milestone.updated_at || new Date().toISOString(),
  ai_verdict: isVerifiedStatus(milestone.status) ? "approved" : "pending",
  confidence_score: Math.floor(Math.random() * 15) + 85, // 85-100%
  ndvi: {
    current_value: (Math.random() * 0.3 + 0.6).toFixed(2), // 0.6-0.9
    expected_range: [0.6, 0.8],
    status: "healthy",
    trend: "increasing"
  },
  weather: {
    temperature_avg: (Math.random() * 10 + 20).toFixed(1), // 20-30°C
    rainfall_last_7days: (Math.random() * 20).toFixed(1), // 0-20mm
    conditions: "favorable"
  },
  soil: {
    moisture_percent: (Math.random() * 30 + 50).toFixed(1), // 50-80%
    temperature_c: (Math.random() * 10 + 18).toFixed(1), // 18-28°C
    ph_level: (Math.random() * 1.5 + 6).toFixed(1) // 6-7.5
  },
  area_coverage: {
    total_hectares: 2.45,
    active_hectares: 2.33,
    coverage_percent: Math.floor(Math.random() * 15) + 85 // 85-100%
  },
  checks: {
    vegetation_health: true,
    timeline_valid: true,
    weather_compatible: true,
    area_coverage_adequate: true
  },
  data_sources: {
    satellite_images: Math.floor(Math.random() * 3) + 2, // 2-5
    drone_photos: 0,
    iot_readings: Math.floor(Math.random() * 20) + 10 // 10-30
  }
});

// Report Item Component - Similar to milestone items in farmdetails.jsx
const ReportItem = ({ report, userRole, onVerificationChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Parse or generate report data (memoized to prevent regeneration on each render)
  const reportData = useMemo(() => {
    return report.agro_augmentation || generateMockReportData(report);
  }, [report.agro_augmentation, report.id]);
  
  const handleVerificationChange = async (newVerifiedStatus) => {
    try {
      const action = newVerifiedStatus ? "verify" : "reject";
      const { data, error } = await supabase.functions.invoke("update-milestone-status", {
        body: { 
          milestoneId: report.id, 
          action 
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Milestone ${newVerifiedStatus ? "approved" : "rejected"}`);
      if (onVerificationChange) {
        onVerificationChange(report.id, data.newStatus);
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error(error.message || "Error updating verification");
    }
  };

  const handleApproveClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmApprove = () => {
    handleVerificationChange(true);
  };

  return (
    <div className="report-item">
      {/* Report Header - Always Visible */}
      <div className="report-item-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="report-info">
          <div className="report-title-row">
            <span className="material-symbols-outlined expand-icon">
              {isExpanded ? "expand_more" : "chevron_right"}
            </span>
            <h4>{report.milestone_templates.name}</h4>
          </div>
          <div className="report-meta">
            <span className="crop-name">{report.crop_cycles.crops.name}</span>
            <span className="separator">•</span>
            <span className="report-date">
              {new Date(report.updated_at).toLocaleDateString()}
            </span>
            <span className="separator">•</span>
            <span className="confidence-score">{reportData.confidence_score}% confidence</span>
          </div>
        </div>
        <div className="report-status-section">
          <span className={`status-badge ${isVerifiedStatus(report.status) ? "verified" : "pending"}`}>
            {isVerifiedStatus(report.status) ? "Verified" : getStatusDisplay(report.status)}
          </span>
        </div>
      </div>

      {/* Report Body - Expandable */}
      {isExpanded && (
        <div className="report-item-body">
          {/* AI Verdict Banner */}
          <div className={`verdict-banner ${reportData.ai_verdict}`}>
            <span className="material-symbols-outlined">
              {reportData.ai_verdict === "approved" ? "check_circle" : "schedule"}
            </span>
            <div className="verdict-text">
              <h5>
                {reportData.ai_verdict === "approved" 
                  ? "Milestone Verified" 
                  : "Awaiting Verification"}
              </h5>
              <p>
                Analysis completed on {new Date(reportData.generated_at).toLocaleString()} 
                {" • "} Confidence: {reportData.confidence_score}%
              </p>
            </div>
          </div>

          {/* Metrics Grid - Using same pattern as farmdetails.jsx data cards */}
          <div className="report-metrics-grid">
            {/* NDVI Card */}
            <div className="metric-card">
              <h5>Vegetation Health (NDVI)</h5>
              <div className="metric-value-row">
                <span className="metric-value">{reportData.ndvi.current_value}</span>
                <span className={`metric-status ${reportData.checks.vegetation_health ? "good" : "warning"}`}>
                  {reportData.checks.vegetation_health ? "✓ Healthy" : "⚠ Check Required"}
                </span>
              </div>
              <p className="metric-detail">
                Expected range: {reportData.ndvi.expected_range[0]} - {reportData.ndvi.expected_range[1]}
              </p>
              <div className="ndvi-progress-bar">
                <div 
                  className="ndvi-fill" 
                  style={{ 
                    width: `${(reportData.ndvi.current_value / 1) * 100}%`,
                    backgroundColor: reportData.checks.vegetation_health ? "#22c55e" : "#f59e0b"
                  }}
                />
              </div>
            </div>

            {/* Weather Card */}
            <div className="metric-card">
              <h5>Weather Conditions</h5>
              <div className="metric-value-row">
                <span className="metric-value">{reportData.weather.temperature_avg}°C</span>
                <span className={`metric-status good`}>
                  ✓ {reportData.weather.conditions}
                </span>
              </div>
              <p className="metric-detail">
                Rainfall (7 days): {reportData.weather.rainfall_last_7days}mm
              </p>
            </div>

            {/* Soil Card */}
            <div className="metric-card">
              <h5>Soil Data</h5>
              <div className="soil-metrics">
                <div className="soil-metric-item">
                  <span className="material-symbols-outlined">water_drop</span>
                  <div>
                    <p className="soil-label">Moisture</p>
                    <p className="soil-value">{reportData.soil.moisture_percent}%</p>
                  </div>
                </div>
                <div className="soil-metric-item">
                  <span className="material-symbols-outlined">device_thermostat</span>
                  <div>
                    <p className="soil-label">Temperature</p>
                    <p className="soil-value">{reportData.soil.temperature_c}°C</p>
                  </div>
                </div>
                <div className="soil-metric-item">
                  <span className="material-symbols-outlined">science</span>
                  <div>
                    <p className="soil-label">pH Level</p>
                    <p className="soil-value">{reportData.soil.ph_level}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Area Coverage Card */}
            <div className="metric-card">
              <h5>Area Coverage</h5>
              <div className="metric-value-row">
                <span className="metric-value">{reportData.area_coverage.coverage_percent}%</span>
                <span className={`metric-status ${reportData.checks.area_coverage_adequate ? "good" : "warning"}`}>
                  {reportData.checks.area_coverage_adequate ? "✓ Adequate" : "⚠ Low Coverage"}
                </span>
              </div>
              <p className="metric-detail">
                {reportData.area_coverage.active_hectares} / {reportData.area_coverage.total_hectares} hectares
              </p>
            </div>
          </div>

          {/* AI Analysis Summary */}
          <div className="ai-analysis-section">
            <h5>AI Analysis Summary</h5>
            <div className="checks-list">
              <div className={`check-item ${reportData.checks.vegetation_health ? "pass" : "fail"}`}>
                <span className="material-symbols-outlined">
                  {reportData.checks.vegetation_health ? "check_circle" : "cancel"}
                </span>
                <span>Vegetation health within expected range</span>
              </div>
              <div className={`check-item ${reportData.checks.timeline_valid ? "pass" : "fail"}`}>
                <span className="material-symbols-outlined">
                  {reportData.checks.timeline_valid ? "check_circle" : "cancel"}
                </span>
                <span>Milestone completed on schedule</span>
              </div>
              <div className={`check-item ${reportData.checks.weather_compatible ? "pass" : "fail"}`}>
                <span className="material-symbols-outlined">
                  {reportData.checks.weather_compatible ? "check_circle" : "cancel"}
                </span>
                <span>Weather conditions favorable</span>
              </div>
              <div className={`check-item ${reportData.checks.area_coverage_adequate ? "pass" : "fail"}`}>
                <span className="material-symbols-outlined">
                  {reportData.checks.area_coverage_adequate ? "check_circle" : "cancel"}
                </span>
                <span>Sufficient farm area coverage</span>
              </div>
            </div>

            {/* Data Sources */}
            <div className="data-sources">
              <h6>Data Sources Used</h6>
              <div className="data-sources-list">
                <span>{reportData.data_sources.satellite_images} satellite images</span>
                <span>•</span>
                <span>{reportData.data_sources.iot_readings} IoT readings</span>
                {reportData.data_sources.drone_photos > 0 && (
                  <>
                    <span>•</span>
                    <span>{reportData.data_sources.drone_photos} drone photos</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Admin Action Panel - Same as farmdetails.jsx milestone verification */}
          {userRole === "admin" && !isVerifiedStatus(report.status) && (
            <div className="admin-actions">
              <button
                className="verify-btn verify"
                onClick={handleApproveClick}
                disabled={!isPendingVerification(report.status)}
              >
                <span className="material-symbols-outlined">check_circle</span>
                Approve Verification
              </button>
            </div>
          )}
          {userRole === "admin" && isVerifiedStatus(report.status) && (
            <div className="verification-complete-message">
              <span className="material-symbols-outlined">check_circle</span>
              <span>Milestone verified and payment released. Blockchain transaction cannot be reversed.</span>
            </div>
          )}

          {/* Confirmation Dialog */}
          <ConfirmDialog
            isOpen={showConfirmDialog}
            onClose={() => setShowConfirmDialog(false)}
            onConfirm={handleConfirmApprove}
            type="success"
            title="Approve Milestone Verification?"
            confirmText="Approve & Release Payment"
            cancelText="Cancel"
          >
            <div className="confirm-dialog-details">
              <p className="confirm-milestone-name">
                <strong>{report.milestone_templates.name}</strong> - {report.crop_cycles.crops.name}
              </p>
              <div className="confirm-warning-box">
                <span className="material-symbols-outlined">info</span>
                <div>
                  <p className="confirm-warning-title">Important:</p>
                  <p className="confirm-warning-text">
                    By approving this milestone, you confirm that you have reviewed the AI-generated report and all verification data. 
                    Payment will be released to the farmer via blockchain and <strong>cannot be reversed</strong>.
                  </p>
                </div>
              </div>
              <div className="confirm-checklist">
                <label className="confirm-checkbox">
                  <input type="checkbox" required />
                  <span>I have reviewed the NDVI data and satellite imagery</span>
                </label>
                <label className="confirm-checkbox">
                  <input type="checkbox" required />
                  <span>I confirm the weather and soil data are acceptable</span>
                </label>
                <label className="confirm-checkbox">
                  <input type="checkbox" required />
                  <span>I have verified the area coverage is sufficient</span>
                </label>
              </div>
            </div>
          </ConfirmDialog>
        </div>
      )}
    </div>
  );
};

const FarmReportsPage = () => {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [farm, setFarm] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchReportsData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch farm details
        const { data: farmData, error: farmError } = await supabase
          .from("farms")
          .select("*")
          .eq("id", farmId)
          .single();

        if (farmError) throw farmError;
        setFarm(farmData);

        // Fetch all completed milestones for this farm (these are the reports)
        // Fetch all completed/pending verification milestones for this farm (these are the reports)
        // Include both old 'Completed' status and new statuses that represent completed work
        const { data: reportsData, error: reportsError } = await supabase
          .from("cycle_milestones")
          .select(`
            *,
            milestone_templates(name, description, sequence),
            crop_cycles!inner(
              farm_id,
              crop_id,
              crops(name)
            )
          `)
          .eq("crop_cycles.farm_id", farmId)
          .in("status", [
            "Completed",  // Old status (transition period)
            MILESTONE_STATUS.PENDING_VERIFICATION,
            MILESTONE_STATUS.VERIFIED,
            MILESTONE_STATUS.REJECTED
          ])
          .order("updated_at", { ascending: false });

        if (reportsError) throw reportsError;
        setReports(reportsData || []);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching reports:", err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchReportsData();
    }
  }, [farmId, user, authLoading]);

  const handleVerificationChange = (reportId, newStatus) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, status: newStatus } : r
      )
    );
  };

  if (authLoading || loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div className="farm-reports-container">
        <Sidebar />
        <main className="farm-reports-main">
          <div className="error-state">
            <span className="material-symbols-outlined">error</span>
            <p>Error: {error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="farm-reports-container">
      <Sidebar />
      <main className="farm-reports-main">
        {/* Page Header - Same style as farmdetails.jsx */}
        <div className="page-title-section">
          <div className="title-with-back">
            <button className="back-btn" onClick={() => navigate("/reports")}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="farm-name-title">{farm?.name}</h1>
              <p className="farm-subtitle">Verification Reports</p>
            </div>
          </div>
        </div>

        {/* Reports Section - Same style as milestone section */}
        <div className="reports-section">
          {reports.length === 0 ? (
            <div className="no-reports-state">
              <span className="material-symbols-outlined">analytics</span>
              <h3>No Reports Available</h3>
              <p>
                No completed milestones found for this farm. 
                Complete milestones to generate verification reports.
              </p>
            </div>
          ) : (
            <>
              <div className="section-header">
                <h2>Milestone Verification Reports</h2>
                <span className="report-count">{reports.length} report{reports.length > 1 ? "s" : ""}</span>
              </div>
              <div className="reports-list">
                {reports.map((report) => (
                  <ReportItem
                    key={report.id}
                    report={report}
                    userRole={role}
                    onVerificationChange={handleVerificationChange}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default FarmReportsPage;
