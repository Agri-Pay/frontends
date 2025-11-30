// src/pages/PaymentsPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import "./payments.css";
import Spinner from "./spinner";
import { useAuth } from "./useauth";
import { toast } from "react-hot-toast";
import { geoJSONToMapboxURL } from "./utils/geometryHelpers";
import { MILESTONE_STATUS, isVerifiedStatus } from "./utils/statusHelpers";

// Payment Farm Card Component - Similar to ReportFarmCard but with payment summary
const PaymentFarmCard = ({ farm }) => {
  const navigate = useNavigate();
  const mapboxApiKey = import.meta.env.VITE_MAPBOX_API_KEY;

  // Get area - prefer stored area_hectares
  const getAreaInHectares = () => {
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
  
  // Payment summary from farm prop
  const paymentSummary = farm.paymentSummary || {
    total: 0,
    paid: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    totalAmount: 0
  };

  // Format currency (amount stored in smallest unit, e.g., paisas/cents)
  const formatCurrency = (amount) => {
    return `Rs. ${((amount || 0) / 100).toLocaleString('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div className="payment-farm-card">
      <img src={imageUrl} alt={`Map of ${farm.name}`} className="card-image" />
      <div className="card-content">
        <div className="card-header">
          <h3>{farm.name}</h3>
          <span className="farm-area">{area} hectares</span>
        </div>
        
        {/* Payment Summary Section */}
        <div className="payment-summary">
          <div className="summary-badge total">
            <span className="badge-value">{paymentSummary.total}</span>
            <span className="badge-label">Total Payments</span>
          </div>
          
          {paymentSummary.total > 0 && (
            <div className="summary-breakdown">
              {paymentSummary.paid > 0 && (
                <span className="status-pill paid">{paymentSummary.paid} Paid</span>
              )}
              {paymentSummary.pending > 0 && (
                <span className="status-pill pending">{paymentSummary.pending} Pending</span>
              )}
              {paymentSummary.processing > 0 && (
                <span className="status-pill processing">{paymentSummary.processing} Processing</span>
              )}
              {paymentSummary.failed > 0 && (
                <span className="status-pill failed">{paymentSummary.failed} Failed</span>
              )}
            </div>
          )}
        </div>
        
        {/* Total Earnings Display */}
        <div className="total-earnings">
          <span className="material-symbols-outlined">payments</span>
          <div>
            <p className="earnings-label">Total Earnings</p>
            <p className="earnings-amount">
              {formatCurrency(paymentSummary.totalAmount)}
            </p>
          </div>
        </div>
        
        {/* Action Button */}
        <button
          onClick={() => navigate(`/payments/${farm.id}`)}
          className="view-payments-btn"
        >
          <span>View Payments</span>
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

// Main Payments Page Component
const PaymentsPage = () => {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPaymentsData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // Fetch farms based on user role
        // Fetch farms based on user role
        let query = supabase
          .from("farms")
          .select(`
            id,
            name,
            area_hectares,
            boundary,
            user_id
          `);

        // Role-based filtering: farmers see only their farms, admins see all
        if (role === "farmer") {
          query = query.eq("user_id", user.id);
        }

        const { data: farmsData, error: farmsError } = await query;

        if (farmsError) {
          throw farmsError;
        }

        console.log(`Fetched ${farmsData?.length || 0} farms for ${role}`);
        
        // Calculate payment summaries for each farm using Promise.all
        const farmsWithPayments = await Promise.all(
          (farmsData || []).map(async (farm) => {
            try {
              // Step 1: Get all crop cycles for this farm
              const { data: cycles, error: cyclesError } = await supabase
                .from("crop_cycles")
                .select("id")
                .eq("farm_id", farm.id);

              if (cyclesError) {
                console.error(`Error fetching cycles for farm ${farm.id}:`, cyclesError);
                return {
                  ...farm,
                  paymentSummary: {
                    total: 0,
                    paid: 0,
                    pending: 0,
                    processing: 0,
                    failed: 0,
                    totalAmount: 0
                  }
                };
              }

              const cycleIds = (cycles || []).map(c => c.id);

              if (cycleIds.length === 0) {
                return {
                  ...farm,
                  paymentSummary: {
                    total: 0,
                    paid: 0,
                    pending: 0,
                    processing: 0,
                    failed: 0,
                    totalAmount: 0
                  }
                };
              }

              // Step 2: Get all verified milestones for these cycles
              const { data: milestones, error: milestonesError } = await supabase
                .from("cycle_milestones")
                .select("payment_status, amount, status")
                .in("crop_cycle_id", cycleIds)
                .eq("status", MILESTONE_STATUS.VERIFIED); // Only count verified milestones

              if (milestonesError) {
                console.error(`Error fetching milestones for farm ${farm.id}:`, milestonesError);
                return {
                  ...farm,
                  paymentSummary: {
                    total: 0,
                    paid: 0,
                    pending: 0,
                    processing: 0,
                    failed: 0,
                    totalAmount: 0
                  }
                };
              }

              // Step 3: Calculate summary statistics
              const summary = {
                total: milestones?.length || 0,
                paid: milestones?.filter(m => m.payment_status === "paid").length || 0,
                pending: milestones?.filter(m => m.payment_status === "pending").length || 0,
                processing: milestones?.filter(m => m.payment_status === "processing").length || 0,
                failed: milestones?.filter(m => m.payment_status === "failed").length || 0,
                totalAmount: milestones
                  ?.filter(m => m.payment_status === "paid")
                  .reduce((sum, m) => sum + (m.amount || 0), 0) || 0
              };

              console.log(`Farm ${farm.name}: ${summary.total} payments, ${summary.paid} paid, Rs. ${summary.totalAmount / 100}`);

              return {
                ...farm,
                paymentSummary: summary
              };
            } catch (err) {
              console.error(`Error calculating payments for farm ${farm.id}:`, err);
              return {
                ...farm,
                paymentSummary: {
                  total: 0,
                  paid: 0,
                  pending: 0,
                  processing: 0,
                  failed: 0,
                  totalAmount: 0
                }
              };
            }
          })
        );

        setFarms(farmsWithPayments);
        
      } catch (err) {
        console.error("Error fetching payments data:", err);
        setError("Failed to load payments data");
        toast.error("Failed to load payments data");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchPaymentsData();
    }
  }, [user, role, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="payments-container">
        <Sidebar />
        <div className="payments-main">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="payments-container">
      <Sidebar />
      <div className="payments-main">
        {/* Page Header */}
        <div className="page-title-section">
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">
            Track payment status and transaction history across all farms
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Farms Grid or Empty State */}
        {farms.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-outlined">payments</span>
            <h3>No Payments Yet</h3>
            <p>
              Payments will appear here once milestones are verified and completed.
            </p>
            {role === "farmer" && (
              <button 
                className="empty-state-btn"
                onClick={() => navigate('/farms')}
              >
                View Your Farms
              </button>
            )}
          </div>
        ) : (
          <div className="payment-farms-grid">
            {farms.map((farm) => (
              <PaymentFarmCard key={farm.id} farm={farm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsPage;
