// src/components/ConfirmDialog.jsx
import React from "react";
import "./confirmdialog.css";

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "default", // 'default', 'warning', 'danger', 'success'
  icon = null,
  children,
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getIconForType = () => {
    if (icon) return icon;
    
    switch (type) {
      case "warning":
        return "warning";
      case "danger":
        return "error";
      case "success":
        return "check_circle";
      default:
        return "info";
    }
  };

  return (
    <div className="confirm-dialog-backdrop" onClick={onClose}>
      <div
        className={`confirm-dialog-content ${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        {(icon || type !== "default") && (
          <div className={`confirm-dialog-icon ${type}`}>
            <span className="material-symbols-outlined">
              {getIconForType()}
            </span>
          </div>
        )}

        {/* Title */}
        {title && <h3 className="confirm-dialog-title">{title}</h3>}

        {/* Message */}
        {message && <p className="confirm-dialog-message">{message}</p>}

        {/* Custom content */}
        {children && <div className="confirm-dialog-body">{children}</div>}

        {/* Actions */}
        <div className="confirm-dialog-actions">
          <button
            className="confirm-dialog-btn cancel-btn"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            className={`confirm-dialog-btn confirm-btn ${type}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
