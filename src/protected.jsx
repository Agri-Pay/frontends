// src/components/ProtectedRoute.jsx
import { useState, useEffect } from "react";
import { supabase } from "./createclient";
import { Navigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import Spinner from "./spinner";

const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);

      // Fetch user role if session exists
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        setUserRole(profile?.role);
      }

      setLoading(false);
    };

    fetchSession();

    // Also listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  // Role-based access control
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    toast.error("You don't have permission to access this page");
    // Redirect based on role
    if (userRole === "admin") {
      return <Navigate to="/admin-dashboard" />;
    } else {
      return <Navigate to="/farmer-dashboard" />;
    }
  }

  return children;
};

export default ProtectedRoute;
