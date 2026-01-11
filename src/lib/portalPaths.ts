// Utility for handling dynamic paths on portal subdomain
// When on portal.masjidirshad.co.uk, teacher/admin routes are under /app

const PORTAL_HOST_REGEX = /(^|\.)portal\.masjidirshad\.co\.uk$/i;

export const isPortalDomain =
  typeof window !== "undefined" &&
  PORTAL_HOST_REGEX.test(window.location.hostname);

// Get the base path for attendance/teacher routes
export const getAttendanceBasePath = () => (isPortalDomain ? "/app" : "");

// Helper to construct attendance portal paths
export const getAttendancePath = (path: string) => {
  const basePath = getAttendanceBasePath();
  // Handle paths that already start with /
  if (path.startsWith("/")) {
    return `${basePath}${path}`;
  }
  return `${basePath}/${path}`;
};

// Common paths
export const paths = {
  auth: () => (isPortalDomain ? "/app/auth" : "/auth"),
  home: () => (isPortalDomain ? "/app" : "/"),
  admin: () => (isPortalDomain ? "/app/admin" : "/admin"),
  adminUsers: () => (isPortalDomain ? "/app/admin/users" : "/admin/users"),
  adminAnnouncements: () => (isPortalDomain ? "/app/admin/announcements" : "/admin/announcements"),
  adminNotifications: () =>
    isPortalDomain ? "/app/admin/notifications" : "/admin/notifications",
  adminTeacherAttendance: () =>
    isPortalDomain
      ? "/app/admin/teacher-attendance"
      : "/admin/teacher-attendance",
  adminStudents: () => (isPortalDomain ? "/app/admin/students" : "/admin/students"),
  adminPortal: () => (isPortalDomain ? "/app/admin/portal" : "/admin/portal"),
  adminRegistrations: () => (isPortalDomain ? "/app/admin/registrations" : "/admin/registrations"),
  adminClasses: () => (isPortalDomain ? "/app/admin/classes" : "/admin/classes"),
  maktab: (maktab: string) => (isPortalDomain ? `/app/${maktab}` : `/${maktab}`),
  maktabDashboard: (maktab: string) =>
    isPortalDomain ? `/app/${maktab}/dashboard` : `/${maktab}/dashboard`,
  maktabStudents: (maktab: string) =>
    isPortalDomain ? `/app/${maktab}/students` : `/${maktab}/students`,
  maktabAuditLogs: (maktab: string) =>
    isPortalDomain ? `/app/${maktab}/audit-logs` : `/${maktab}/audit-logs`,
  auditLogs: () => (isPortalDomain ? "/app/audit-logs" : "/audit-logs"),
  adminEmailTesting: () => (isPortalDomain ? "/app/admin/email-testing" : "/admin/email-testing"),
};
