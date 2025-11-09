// src/pages/FarmPaymentsPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import Sidebar from "./sidebar";
import Spinner from "./spinner";
import { useAuth } from "./useauth";
import { toast } from "react-hot-toast";
import "./farmpayments.css";

// Helper Functions
const formatCurrency = (amount) => {
  return `Rs. ${((amount || 0) / 100).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatDate = (dateString) => {
  if (!dateString) return "Not set";
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatPaymentStatus = (status) => {
  const statusMap = {
    paid: "Paid",
    pending: "Pending",
    processing: "Processing",
    failed: "Failed"
  };
  return statusMap[status] || status;
};

const getPaymentIcon = (status) => {
  const iconMap = {
    paid: "check_circle",
    pending: "schedule",
    processing: "sync",
    failed: "error"
  };
  return iconMap[status] || "payments";
};

// Payment Milestone Item Component
const PaymentMilestoneItem = ({ milestone, farmId }) => {
  const navigate = useNavigate();

  return (
    <div className="payment-milestone-item">
      {/* Milestone Header Row */}
      <div className="milestone-header-row">
        <div className="milestone-info">
          <h4>{milestone.milestone_templates?.name || "Unnamed Milestone"}</h4>
          <span className="milestone-date">
            Completed: {formatDate(milestone.updated_at)}
          </span>
        </div>
        
        <div className="milestone-payment-amount">
          <span className="amount-value">
            {formatCurrency(milestone.amount)}
          </span>
        </div>
      </div>
      
      {/* Status Row */}
      <div className="milestone-status-row">
        {/* Approval Status */}
        <div className="status-group">
          <span className="status-label">Approval:</span>
          <span className={`status-badge ${milestone.is_verified ? "verified" : "pending"}`}>
            <span className="material-symbols-outlined">
              {milestone.is_verified ? "check_circle" : "schedule"}
            </span>
            {milestone.is_verified ? "Approved" : "Pending Review"}
          </span>
        </div>
        
        {/* Payment Status */}
        <div className="status-group">
          <span className="status-label">Payment:</span>
          <span className={`status-badge payment-${milestone.payment_status}`}>
            <span className="material-symbols-outlined">
              {getPaymentIcon(milestone.payment_status)}
            </span>
            {formatPaymentStatus(milestone.payment_status)}
          </span>
        </div>
      </div>
      
      {/* Action Buttons Row */}
      <div className="milestone-actions-row">
        {/* View Report Link */}
        <button 
          className="action-btn view-report"
          onClick={() => navigate(`/reports/${farmId}#milestone-${milestone.id}`)}
        >
          <span className="material-symbols-outlined">description</span>
          <span>View Report</span>
        </button>
        
        {/* Etherscan Link (only if payment is confirmed and has tx_hash) */}
        {milestone.payment_status === "paid" && milestone.transactions?.length > 0 && milestone.transactions[0].tx_hash && (
          <a
            href={`https://etherscan.io/tx/${milestone.transactions[0].tx_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn etherscan-link"
          >
            <span className="material-symbols-outlined">open_in_new</span>
            <span>View on Etherscan</span>
          </a>
        )}
        
        {/* Transaction Pending Indicator */}
        {milestone.payment_status === "processing" && (
          <div className="transaction-pending">
            <span className="material-symbols-outlined rotating">sync</span>
            <span>Transaction processing...</span>
          </div>
        )}
        
        {/* Failed Payment Info */}
        {milestone.payment_status === "failed" && (
          <div className="payment-failed-info">
            <span className="material-symbols-outlined">error</span>
            <span>Payment failed. Contact support.</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Crop Cycle Payment Section Component
const CropCyclePaymentSection = ({ cycle, farmId }) => {
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded

  // Calculate total earnings for this cycle
  const calculateCycleTotal = () => {
    return cycle.milestones
      ?.filter(m => m.payment_status === "paid")
      .reduce((sum, m) => sum + (m.amount || 0), 0) || 0;
  };

  return (
    <div className="crop-cycle-payment-section">
      {/* Cycle Header */}
      <div className="cycle-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="cycle-info">
          <span className="material-symbols-outlined expand-icon">
            {isExpanded ? "expand_more" : "chevron_right"}
          </span>
          <span className="material-symbols-outlined crop-icon">agriculture</span>
          <div>
            <h3>{cycle.crops?.name || "Unknown Crop"}</h3>
            <p className="cycle-dates">
              {formatDate(cycle.start_date)} - {cycle.end_date ? formatDate(cycle.end_date) : "Ongoing"}
            </p>
          </div>
        </div>
        
        <div className="cycle-summary">
          <span className={`cycle-status-badge ${cycle.is_active ? "active" : "completed"}`}>
            {cycle.is_active ? "Active" : "Completed"}
          </span>
          <div className="cycle-earnings">
            <span className="earnings-label">Total:</span>
            <span className="earnings-amount">
              {formatCurrency(calculateCycleTotal())}
            </span>
          </div>
          <div className="cycle-count">
            <span>{cycle.milestones?.length || 0} payment{(cycle.milestones?.length !== 1) ? "s" : ""}</span>
          </div>
        </div>
      </div>
      
      {/* Expandable Milestones List */}
      {isExpanded && (
        <div className="milestones-payment-list">
          {cycle.milestones && cycle.milestones.length > 0 ? (
            cycle.milestones.map(milestone => (
              <PaymentMilestoneItem 
                key={milestone.id} 
                milestone={milestone}
                farmId={farmId}
              />
            ))
          ) : (
            <div className="no-milestones-message">
              <span className="material-symbols-outlined">info</span>
              <p>No verified milestones with payments for this crop cycle yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Farm Payments Page Component
const FarmPaymentsPage = () => {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [farm, setFarm] = useState(null);
  const [cycles, setCycles] = useState([]);
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

        // Fetch farm details
        const { data: farmData, error: farmError } = await supabase
          .from("farms")
          .select("*")
          .eq("id", farmId)
          .single();

        if (farmError) throw farmError;

        // Check user access (farmers can only see their own farms)
        if (role === "farmer" && farmData.user_id !== user.id) {
          toast.error("You don't have access to this farm's payments");
          navigate("/payments");
          return;
        }

        setFarm(farmData);

        // Fetch crop cycles with crop names
        const { data: cyclesData, error: cyclesError } = await supabase
          .from("crop_cycles")
          .select(`
            id,
            start_date,
            end_date,
            is_active,
            crops (
              id,
              name
            )
          `)
          .eq("farm_id", farmId)
          .order("start_date", { ascending: false });

        if (cyclesError) throw cyclesError;

        // For each cycle, fetch verified milestones with payment data and transactions
        const cyclesWithPayments = await Promise.all(
          (cyclesData || []).map(async (cycle) => {
            const { data: milestonesData, error: milestonesError } = await supabase
              .from("cycle_milestones")
              .select(`
                id,
                status,
                is_verified,
                amount,
                payment_status,
                updated_at,
                milestone_templates (
                  id,
                  name,
                  description
                ),
                transactions (
                  id,
                  tx_hash,
                  status,
                  created_at
                )
              `)
              .eq("crop_cycle_id", cycle.id)
              .eq("is_verified", true) // Only show approved milestones
              .order("updated_at", { ascending: false });

            if (milestonesError) {
              console.error(`Error fetching milestones for cycle ${cycle.id}:`, milestonesError);
              return { ...cycle, milestones: [] };
            }

            return {
              ...cycle,
              milestones: milestonesData || []
            };
          })
        );

        // Filter out cycles with no payments
        const cyclesWithData = cyclesWithPayments.filter(
          cycle => cycle.milestones.length > 0
        );

        console.log(`Fetched ${cyclesWithData.length} cycles with payments for farm ${farmData.name}`);
        setCycles(cyclesWithData);

      } catch (err) {
        console.error("Error fetching farm payments:", err);
        setError(err.message || "Failed to load payment data");
        toast.error("Failed to load payment data");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchPaymentsData();
    }
  }, [farmId, user, role, authLoading, navigate]);

  // Calculate total earnings across all cycles
  const calculateTotalEarnings = () => {
    return cycles.reduce((total, cycle) => {
      const cycleTotal = cycle.milestones
        ?.filter(m => m.payment_status === "paid")
        .reduce((sum, m) => sum + (m.amount || 0), 0) || 0;
      return total + cycleTotal;
    }, 0);
  };

  if (authLoading || loading) {
    return (
      <div className="farm-payments-container">
        <Sidebar />
        <div className="farm-payments-main">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="farm-payments-container">
        <Sidebar />
        <main className="farm-payments-main">
          <div className="error-state">
            <span className="material-symbols-outlined">error</span>
            <p>Error: {error}</p>
            <button 
              className="back-to-payments-btn"
              onClick={() => navigate("/payments")}
            >
              Back to Payments
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="farm-payments-container">
      <Sidebar />
      <main className="farm-payments-main">
        {/* Page Header */}
        <div className="page-title-section">
          <div className="title-with-back">
            <button className="back-btn" onClick={() => navigate("/payments")}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="farm-name-title">{farm?.name}</h1>
              <p className="farm-subtitle">
                Payment History • Total Earnings: {formatCurrency(calculateTotalEarnings())}
              </p>
            </div>
          </div>
        </div>

        {/* Payments Content */}
        {cycles.length === 0 ? (
          <div className="empty-payments-state">
            <span className="material-symbols-outlined">receipt_long</span>
            <h3>No Payments for This Farm Yet</h3>
            <p>
              Payments will appear here once milestones are verified by admins and 
              transactions are processed.
            </p>
            <button 
              className="back-to-payments-btn"
              onClick={() => navigate('/payments')}
            >
              Back to All Payments
            </button>
          </div>
        ) : (
          <div className="crop-cycles-container">
            {cycles.map((cycle) => (
              <CropCyclePaymentSection 
                key={cycle.id} 
                cycle={cycle}
                farmId={farmId}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FarmPaymentsPage;
