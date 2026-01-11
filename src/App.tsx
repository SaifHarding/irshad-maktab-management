import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase as adminSupabase } from "@/integrations/supabase/client";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { Session } from "@supabase/supabase-js";
import { GhostModeProvider } from "@/contexts/GhostModeContext";
import { ParentGhostModeProvider } from "@/contexts/ParentGhostModeContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { isPortalDomain } from "@/lib/portalPaths";

// Use the appropriate client based on domain to avoid multiple GoTrueClient instances
const supabase = isPortalDomain ? portalSupabase : adminSupabase;
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import InitialSetup from "./pages/InitialSetup";
import AdminPanel from "./pages/AdminPanel";
import UserManagement from "./pages/UserManagement";
import Announcements from "./pages/Announcements";
import Notifications from "./pages/Notifications";
import TeacherAttendance from "./pages/TeacherAttendance";
import StudentDirectory from "./pages/StudentDirectory";
import MaktabAttendance from "./pages/MaktabAttendance";
import MaktabDashboard from "./pages/MaktabDashboard";
import MaktabStudents from "./pages/MaktabStudents";
import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound";
import PortalManagement from "./pages/PortalManagement";
import Registrations from "./pages/Registrations";
import EmailTesting from "./pages/EmailTesting";
import MaktabClasses from "./pages/MaktabClasses";
import PortalAuth from "./pages/portal/PortalAuth";
import PortalCallback from "./pages/portal/PortalCallback";
import PortalLinkExpired from "./pages/portal/PortalLinkExpired";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalAttendance from "./pages/portal/PortalAttendance";
import PortalProgress from "./pages/portal/PortalProgress";
import PortalProfile from "./pages/portal/PortalProfile";
import PortalBilling from "./pages/portal/PortalBilling";
import PortalMessages from "./pages/portal/PortalMessages";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if session has expired based on custom timeout
      if (session) {
        const sessionExpiry = localStorage.getItem("session_expiry");
        if (sessionExpiry && Date.now() > parseInt(sessionExpiry)) {
          // Session has expired, sign out
          supabase.auth.signOut();
          localStorage.removeItem("session_expiry");
          localStorage.removeItem("keep_signed_in");
          setSession(null);
          setLoading(false);
          return;
        }
      }

      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set up periodic session expiry check
  useEffect(() => {
    if (!session) return;

    const checkSessionExpiry = () => {
      const sessionExpiry = localStorage.getItem("session_expiry");
      if (sessionExpiry && Date.now() > parseInt(sessionExpiry)) {
        // Session has expired, sign out
        supabase.auth.signOut();
        localStorage.removeItem("session_expiry");
        localStorage.removeItem("keep_signed_in");
      }
    };

    // Check every minute
    const interval = setInterval(checkSessionExpiry, 60000);

    return () => clearInterval(interval);
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Define routes based on domain
  const portalRoutes = (
    <>
      {/* Parent Portal Routes - Homepage and root paths */}
      <Route path="/" element={<PortalDashboard />} />
      <Route path="/auth" element={<PortalAuth />} />
      <Route path="/callback" element={<PortalCallback />} />
      <Route path="/link-expired" element={<PortalLinkExpired />} />
      <Route path="/student-attendance" element={<PortalAttendance />} />
      <Route path="/progress" element={<PortalProgress />} />
      <Route path="/profile" element={<PortalProfile />} />
      <Route path="/billing" element={<PortalBilling />} />
      <Route path="/messages" element={<PortalMessages />} />

      {/* Backwards-compatible portal-prefixed routes (avoid 404s if old links/bookmarks exist) */}
      <Route path="/portal" element={<Navigate to="/" replace />} />
      <Route path="/portal/auth" element={<Navigate to="/auth" replace />} />
      <Route path="/portal/callback" element={<Navigate to="/callback" replace />} />
      <Route path="/portal/link-expired" element={<Navigate to="/link-expired" replace />} />
      <Route path="/portal/attendance" element={<Navigate to="/student-attendance" replace />} />
      <Route path="/portal/progress" element={<Navigate to="/progress" replace />} />
      <Route path="/portal/profile" element={<Navigate to="/profile" replace />} />
      <Route path="/portal/billing" element={<Navigate to="/billing" replace />} />
      <Route path="/portal/messages" element={<Navigate to="/messages" replace />} />
      <Route path="/portal/*" element={<Navigate to="/" replace />} />

      {/* Teacher/Admin Attendance Portal Routes - nested under /app */}
      {/* These routes require admin or teacher role - parents cannot access */}
      <Route path="/app/setup" element={<InitialSetup />} />
      <Route path="/app/auth" element={<Auth />} />
      <Route
        path="/app"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <Home />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <AdminPanel />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/users"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <UserManagement />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/announcements"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <Announcements />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/notifications"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <Notifications />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/teacher-attendance"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <TeacherAttendance />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/students"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <StudentDirectory />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/portal"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <PortalManagement />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/registrations"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <Registrations />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/email-testing"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <EmailTesting />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/admin/classes"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin"]}>
              <MaktabClasses />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/:maktab"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <MaktabAttendance />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/:maktab/dashboard"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <MaktabDashboard />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/:maktab/students"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <MaktabStudents />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/audit-logs"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <AuditLogs />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route
        path="/app/:maktab/audit-logs"
        element={
          session ? (
            <RoleProtectedRoute allowedRoles={["admin", "teacher"]}>
              <AuditLogs />
            </RoleProtectedRoute>
          ) : (
            <Navigate to="/app/auth" replace />
          )
        }
      />
      <Route path="*" element={<NotFound />} />
    </>
  );

  const mainRoutes = (
    <>
      {/* Main domain routes */}
      <Route path="/setup" element={<InitialSetup />} />
      <Route path="/auth" element={<Auth />} />
      <Route 
        path="/" 
        element={session ? <Home /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin" 
        element={session ? <AdminPanel /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/users" 
        element={session ? <UserManagement /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/announcements" 
        element={session ? <Announcements /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/notifications" 
        element={session ? <Notifications /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/teacher-attendance" 
        element={session ? <TeacherAttendance /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/students" 
        element={session ? <StudentDirectory /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/portal" 
        element={session ? <PortalManagement /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/registrations" 
        element={session ? <Registrations /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/email-testing" 
        element={session ? <EmailTesting /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/admin/classes" 
        element={session ? <MaktabClasses /> : <Navigate to="/auth" replace />} 
      />
      <Route
        path="/:maktab"
        element={session ? <MaktabAttendance /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/:maktab/dashboard" 
        element={session ? <MaktabDashboard /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/:maktab/students" 
        element={session ? <MaktabStudents /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/audit-logs" 
        element={session ? <AuditLogs /> : <Navigate to="/auth" replace />} 
      />
      <Route 
        path="/:maktab/audit-logs" 
        element={session ? <AuditLogs /> : <Navigate to="/auth" replace />} 
      />
      {/* Portal Routes - for non-portal domain access */}
      <Route path="/portal/auth" element={<PortalAuth />} />
      <Route path="/portal/callback" element={<PortalCallback />} />
      <Route path="/portal/link-expired" element={<PortalLinkExpired />} />
      <Route path="/portal" element={<PortalDashboard />} />
      <Route path="/portal/attendance" element={<PortalAttendance />} />
      <Route path="/portal/progress" element={<PortalProgress />} />
      <Route path="/portal/profile" element={<PortalProfile />} />
      <Route path="/portal/billing" element={<PortalBilling />} />
      <Route path="/portal/messages" element={<PortalMessages />} />
      <Route path="*" element={<NotFound />} />
    </>
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <GhostModeProvider>
          <ParentGhostModeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {isPortalDomain ? portalRoutes : mainRoutes}
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ParentGhostModeProvider>
        </GhostModeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
