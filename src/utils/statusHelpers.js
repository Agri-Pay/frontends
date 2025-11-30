/**
 * Milestone status utilities for AgriPay
 * Provides consistent status display, colors, and validation across the app
 * 
 * NEW STATUS SYSTEM (replaces boolean is_verified):
 * - not_started: Milestone has not begun
 * - in_progress: Farmer is working on milestone
 * - pending_verification: Farmer marked complete, awaiting admin verification
 * - verified: Admin verified, payment can be released
 * - rejected: Admin rejected verification
 * - skipped: Milestone skipped (with reason)
 * 
 * LEGACY VALUES (still in DB during transition):
 * - Not Started, In Progress, Completed
 */

// Status constants for type safety
export const MILESTONE_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  SKIPPED: 'skipped',
  // Legacy values (for backward compatibility during transition)
  LEGACY_NOT_STARTED: 'Not Started',
  LEGACY_IN_PROGRESS: 'In Progress',
  LEGACY_COMPLETED: 'Completed'
};

// Map legacy status values to new enum values
const LEGACY_STATUS_MAP = {
  'Not Started': MILESTONE_STATUSES.NOT_STARTED,
  'In Progress': MILESTONE_STATUSES.IN_PROGRESS,
  'Completed': MILESTONE_STATUSES.PENDING_VERIFICATION // Completed now means pending verification
};

/**
 * Normalize status value to new enum format
 * Handles both legacy and new status values
 * 
 * @param {string} status - Status value from database
 * @returns {string} Normalized status value
 */
export const normalizeStatus = (status) => {
  if (!status) return MILESTONE_STATUSES.NOT_STARTED;
  
  // Check if it's a legacy value
  if (LEGACY_STATUS_MAP[status]) {
    return LEGACY_STATUS_MAP[status];
  }
  
  // Already a new value, return as-is
  return status;
};

/**
 * Get human-readable display text for status
 * 
 * @param {string} status - Status value (legacy or new)
 * @returns {string} Display text
 */
export const getMilestoneStatusDisplay = (status) => {
  const normalized = normalizeStatus(status);
  
  const displayMap = {
    [MILESTONE_STATUSES.NOT_STARTED]: 'Not Started',
    [MILESTONE_STATUSES.IN_PROGRESS]: 'In Progress',
    [MILESTONE_STATUSES.PENDING_VERIFICATION]: 'Pending Verification',
    [MILESTONE_STATUSES.VERIFIED]: 'Verified',
    [MILESTONE_STATUSES.REJECTED]: 'Rejected',
    [MILESTONE_STATUSES.SKIPPED]: 'Skipped'
  };
  
  return displayMap[normalized] || status;
};

/**
 * Get color for status badge/pill
 * 
 * @param {string} status - Status value (legacy or new)
 * @returns {string} Hex color code
 */
export const getMilestoneStatusColor = (status) => {
  const normalized = normalizeStatus(status);
  
  const colorMap = {
    [MILESTONE_STATUSES.NOT_STARTED]: '#94a3b8',    // gray/slate
    [MILESTONE_STATUSES.IN_PROGRESS]: '#3b82f6',    // blue
    [MILESTONE_STATUSES.PENDING_VERIFICATION]: '#f59e0b', // amber/orange
    [MILESTONE_STATUSES.VERIFIED]: '#22c55e',       // green
    [MILESTONE_STATUSES.REJECTED]: '#ef4444',       // red
    [MILESTONE_STATUSES.SKIPPED]: '#64748b'         // slate
  };
  
  return colorMap[normalized] || '#94a3b8';
};

/**
 * Get background color for status badge (lighter version)
 * 
 * @param {string} status - Status value
 * @returns {string} Hex color code
 */
export const getMilestoneStatusBgColor = (status) => {
  const normalized = normalizeStatus(status);
  
  const colorMap = {
    [MILESTONE_STATUSES.NOT_STARTED]: '#f1f5f9',
    [MILESTONE_STATUSES.IN_PROGRESS]: '#dbeafe',
    [MILESTONE_STATUSES.PENDING_VERIFICATION]: '#fef3c7',
    [MILESTONE_STATUSES.VERIFIED]: '#dcfce7',
    [MILESTONE_STATUSES.REJECTED]: '#fee2e2',
    [MILESTONE_STATUSES.SKIPPED]: '#f1f5f9'
  };
  
  return colorMap[normalized] || '#f1f5f9';
};

/**
 * Check if a status is a terminal state (no further changes expected)
 * 
 * @param {string} status - Status value
 * @returns {boolean} True if terminal
 */
export const isTerminalStatus = (status) => {
  const normalized = normalizeStatus(status);
  return [
    MILESTONE_STATUSES.VERIFIED,
    MILESTONE_STATUSES.REJECTED,
    MILESTONE_STATUSES.SKIPPED
  ].includes(normalized);
};

/**
 * Check if milestone is in a state where farmer can update it
 * 
 * @param {string} status - Current status
 * @returns {boolean} True if farmer can update
 */
export const canFarmerUpdate = (status) => {
  const normalized = normalizeStatus(status);
  return [
    MILESTONE_STATUSES.NOT_STARTED,
    MILESTONE_STATUSES.IN_PROGRESS
  ].includes(normalized);
};

/**
 * Check if milestone is ready for admin verification
 * 
 * @param {string} status - Current status
 * @returns {boolean} True if can be verified
 */
export const canAdminVerify = (status) => {
  const normalized = normalizeStatus(status);
  return normalized === MILESTONE_STATUSES.PENDING_VERIFICATION;
};

/**
 * Check if milestone has been verified (payment eligible)
 * Replaces the old is_verified boolean check
 * 
 * @param {string} status - Status value
 * @returns {boolean} True if verified
 */
export const isVerified = (status) => {
  return normalizeStatus(status) === MILESTONE_STATUSES.VERIFIED;
};

/**
 * Get CSS class name for status (for styling)
 * Converts status to kebab-case for CSS compatibility
 * 
 * @param {string} status - Status value
 * @returns {string} CSS class name
 */
export const getStatusClassName = (status) => {
  const normalized = normalizeStatus(status);
  // Convert underscores to hyphens for CSS
  return normalized.replace(/_/g, '-');
};

// ============================================
// ALIASES for backward compatibility
// These provide alternate names used in various components
// ============================================

// Alias for MILESTONE_STATUSES
export const MILESTONE_STATUS = MILESTONE_STATUSES;

// Alias for isVerified
export const isVerifiedStatus = isVerified;

// Alias for getMilestoneStatusDisplay
export const getStatusDisplay = getMilestoneStatusDisplay;

// Alias for getMilestoneStatusColor
export const getStatusColor = getMilestoneStatusColor;

// Alias for canAdminVerify
export const isPendingVerification = canAdminVerify;

/**
 * Check if status represents a completed milestone (pending verification, verified, or legacy Completed)
 * Used for counting reports/completed milestones
 * 
 * @param {string} status - Status value
 * @returns {boolean} True if completed
 */
export const isCompletedStatus = (status) => {
  const normalized = normalizeStatus(status);
  return [
    MILESTONE_STATUSES.PENDING_VERIFICATION,
    MILESTONE_STATUSES.VERIFIED,
    MILESTONE_STATUSES.REJECTED
  ].includes(normalized);
};

/**
 * Get available status transitions for farmer
 * 
 * @param {string} currentStatus - Current milestone status
 * @returns {Array<{value: string, label: string}>} Available status options
 */
export const getFarmerStatusOptions = (currentStatus) => {
  const normalized = normalizeStatus(currentStatus);
  
  // Terminal statuses - no options
  if (isTerminalStatus(normalized)) {
    return [];
  }
  
  // Pending verification - farmer cannot change
  if (normalized === MILESTONE_STATUSES.PENDING_VERIFICATION) {
    return [];
  }
  
  // Farmer can move through: not_started -> in_progress -> pending_verification
  return [
    { value: MILESTONE_STATUSES.NOT_STARTED, label: 'Not Started' },
    { value: MILESTONE_STATUSES.IN_PROGRESS, label: 'In Progress' },
    { value: MILESTONE_STATUSES.PENDING_VERIFICATION, label: 'Mark as Complete' }
  ];
};

/**
 * Get available status transitions for admin
 * 
 * @param {string} currentStatus - Current milestone status
 * @returns {Array<{value: string, label: string}>} Available status options
 */
export const getAdminStatusOptions = (currentStatus) => {
  const normalized = normalizeStatus(currentStatus);
  
  // Terminal statuses - limited options (only skip for some)
  if (normalized === MILESTONE_STATUSES.VERIFIED) {
    return []; // Cannot undo verification (blockchain)
  }
  
  if (normalized === MILESTONE_STATUSES.PENDING_VERIFICATION) {
    return [
      { value: MILESTONE_STATUSES.VERIFIED, label: 'Approve & Verify' },
      { value: MILESTONE_STATUSES.REJECTED, label: 'Reject' }
    ];
  }
  
  // Admin can also skip milestones
  return [
    { value: MILESTONE_STATUSES.SKIPPED, label: 'Skip Milestone' }
  ];
};
