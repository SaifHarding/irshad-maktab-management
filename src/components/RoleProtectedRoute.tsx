import { useState, useEffect, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPortalDomain } from "@/lib/portalPaths";
import { toast } from "sonner";

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: ("admin" | "teacher")[];
  redirectTo?: string;
}

export function RoleProtectedRoute({ 
  children, 
  allowedRoles,
  redirectTo 
}: RoleProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        // Check if user has any of the allowed roles
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error checking roles:", error);
          setHasAccess(false);
          setLoading(false);
          return;
        }

        const userRoles = roles?.map(r => r.role) || [];
        const hasAllowedRole = allowedRoles.some(role => userRoles.includes(role));
        
        setHasAccess(hasAllowedRole);
        setLoading(false);
      } catch (err) {
        console.error("Error in role check:", err);
        setHasAccess(false);
        setLoading(false);
      }
    };

    checkRole();
  }, [allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    // Show toast notification for parents
    toast.error("Access Restricted", {
      description: "This area is for teachers and administrators only.",
      duration: 4000,
    });
    
    // Redirect parents back to portal dashboard
    const defaultRedirect = isPortalDomain ? "/" : "/portal";
    return <Navigate to={redirectTo || defaultRedirect} replace />;
  }

  return <>{children}</>;
}
