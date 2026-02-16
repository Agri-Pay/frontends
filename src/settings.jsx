// src/pages/SettingsPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./createclient";
import { useAuth } from "./useauth";
import MainLayout from "./layout";
import Spinner from "./spinner";
import ConfirmDialog from "./confirmdialog";
import { toast } from "react-hot-toast";
import "./settings.css";

const SettingsPage = () => {
    const { user, role, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    // Profile state
    const [fullName, setFullName] = useState("");
    const [originalName, setOriginalName] = useState("");
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);

    // Password state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordSaving, setPasswordSaving] = useState(false);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: "",
        message: "",
        type: "danger",
        onConfirm: () => {},
    });

    // Fetch profile on mount
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", user.id)
                    .single();
                if (error) throw error;
                setFullName(data?.full_name || "");
                setOriginalName(data?.full_name || "");
            } catch (err) {
                console.error("Error fetching profile:", err);
                toast.error("Failed to load profile");
            } finally {
                setProfileLoading(false);
            }
        };
        fetchProfile();
    }, [user]);

    // Save profile
    const handleSaveProfile = async () => {
        if (!fullName.trim()) {
            toast.error("Name cannot be empty");
            return;
        }
        setProfileSaving(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ full_name: fullName.trim() })
                .eq("id", user.id);
            if (error) throw error;
            setOriginalName(fullName.trim());
            toast.success("Profile updated successfully");
        } catch (err) {
            console.error("Error updating profile:", err);
            toast.error("Failed to update profile");
        } finally {
            setProfileSaving(false);
        }
    };

    // Change password
    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword.length < 8) {
            toast.error("New password must be at least 8 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        setPasswordSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (error) throw error;
            toast.success("Password updated successfully");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            console.error("Error changing password:", err);
            toast.error(err.message || "Failed to change password");
        } finally {
            setPasswordSaving(false);
        }
    };

    // Logout
    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate("/login");
        } catch (err) {
            toast.error("Failed to log out");
        }
    };

    // Delete account
    const handleDeleteAccount = () => {
        setConfirmDialog({
            isOpen: true,
            title: "Delete Account",
            message:
                "Are you sure you want to delete your account? This action is permanent and cannot be undone. All your farms, data, and reports will be lost.",
            type: "danger",
            confirmText: "Delete My Account",
            onConfirm: async () => {
                try {
                    // Note: actual account deletion requires a server-side function
                    // For now, sign out the user
                    toast.error("Please contact support to delete your account.");
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                } catch (err) {
                    toast.error("Failed to delete account");
                }
            },
        });
    };

    if (authLoading || profileLoading) {
        return (
            <MainLayout>
                <Spinner />
            </MainLayout>
        );
    }

    const hasProfileChanges = fullName.trim() !== originalName;

    return (
        <MainLayout>
            <div className="settings-page">
                <div className="settings-header">
                    <h1 className="settings-title">Settings</h1>
                    <p className="settings-subtitle">
                        Manage your account preferences and security
                    </p>
                </div>

                {/* --- Profile Section --- */}
                <section className="settings-section">
                    <div className="section-heading">
                        <span className="section-icon material-symbols-outlined">
                            person
                        </span>
                        <div>
                            <h2>Profile Information</h2>
                            <p>Update your personal details</p>
                        </div>
                    </div>
                    <div className="settings-card">
                        <div className="settings-field">
                            <label>Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </div>
                        <div className="settings-field">
                            <label>Email Address</label>
                            <input
                                type="email"
                                value={user?.email || ""}
                                disabled
                                className="disabled-input"
                            />
                            <span className="field-hint">
                                Email cannot be changed
                            </span>
                        </div>
                        <div className="settings-field">
                            <label>Account Role</label>
                            <div className="role-badge-container">
                                <span className={`role-badge ${role}`}>
                                    <span className="material-symbols-outlined">
                                        {role === "admin" ? "admin_panel_settings" : "agriculture"}
                                    </span>
                                    {role === "admin" ? "Administrator" : "Farmer"}
                                </span>
                            </div>
                        </div>
                        {hasProfileChanges && (
                            <div className="settings-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setFullName(originalName)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={handleSaveProfile}
                                    disabled={profileSaving}
                                >
                                    {profileSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* --- Security Section --- */}
                <section className="settings-section">
                    <div className="section-heading">
                        <span className="section-icon material-symbols-outlined">
                            lock
                        </span>
                        <div>
                            <h2>Security</h2>
                            <p>Manage your password</p>
                        </div>
                    </div>
                    <div className="settings-card">
                        <form onSubmit={handleChangePassword}>
                            <div className="settings-field">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) =>
                                        setNewPassword(e.target.value)
                                    }
                                    placeholder="Enter new password"
                                    minLength={8}
                                    required
                                />
                            </div>
                            <div className="settings-field">
                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    placeholder="Confirm new password"
                                    required
                                />
                                {confirmPassword && newPassword !== confirmPassword && (
                                    <span className="field-error">
                                        Passwords do not match
                                    </span>
                                )}
                                {confirmPassword && newPassword === confirmPassword && (
                                    <span className="field-success">
                                        Passwords match
                                    </span>
                                )}
                            </div>
                            <div className="settings-actions">
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={passwordSaving || !newPassword || !confirmPassword}
                                >
                                    {passwordSaving
                                        ? "Updating..."
                                        : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </section>

                {/* --- Account Section --- */}
                <section className="settings-section">
                    <div className="section-heading">
                        <span className="section-icon material-symbols-outlined">
                            settings
                        </span>
                        <div>
                            <h2>Account</h2>
                            <p>Manage your account</p>
                        </div>
                    </div>

                    <div className="settings-card">
                        <div className="account-action">
                            <div className="account-action-info">
                                <h3>Log Out</h3>
                                <p>Sign out of your account on this device</p>
                            </div>
                            <button
                                className="btn-outline"
                                onClick={handleLogout}
                            >
                                <span className="material-symbols-outlined">logout</span>
                                Log Out
                            </button>
                        </div>
                    </div>

                    <div className="settings-card danger-card">
                        <div className="account-action">
                            <div className="account-action-info">
                                <h3>Delete Account</h3>
                                <p>
                                    Permanently delete your account and all associated data. This cannot be undone.
                                </p>
                            </div>
                            <button
                                className="btn-danger"
                                onClick={handleDeleteAccount}
                            >
                                <span className="material-symbols-outlined">delete_forever</span>
                                Delete Account
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {confirmDialog.isOpen && (
                <ConfirmDialog
                    isOpen={confirmDialog.isOpen}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    type={confirmDialog.type}
                    confirmText={confirmDialog.confirmText}
                    onConfirm={confirmDialog.onConfirm}
                    onClose={() =>
                        setConfirmDialog((prev) => ({
                            ...prev,
                            isOpen: false,
                        }))
                    }
                />
            )}
        </MainLayout>
    );
};

export default SettingsPage;
