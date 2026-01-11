import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Home,
  Calendar,
  TrendingUp,
  User,
  CreditCard,
  Bell,
  LogOut,
  BookOpen,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import ParentGhostModeBanner from "./ParentGhostModeBanner";
import { useParentGhostMode } from "@/contexts/ParentGhostModeContext";

interface PortalLayoutProps {
  children: ReactNode;
  title?: string;
}

import { isPortalDomain } from "@/lib/portalPaths";

// Dynamic paths based on domain
const getPath = (path: string) => (isPortalDomain ? path : `/portal${path}`);

// Main nav items shown in bottom nav on mobile
const mainNavItems = [
  { path: "/", altPath: "/portal", label: "Home", icon: Home },
  { path: "/student-attendance", altPath: "/portal/attendance", label: "Attendance", icon: Calendar },
  { path: "/progress", altPath: "/portal/progress", label: "Progress", icon: TrendingUp },
];

// Secondary items for burger menu on mobile (without messages - moved to header)
const menuItems = [
  { path: "/profile", altPath: "/portal/profile", label: "Profile", icon: User },
  { path: "/billing", altPath: "/portal/billing", label: "Billing", icon: CreditCard },
];

export function PortalLayout({ children, title }: PortalLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const { isGhostMode } = useParentGhostMode();

  // Fetch unread notification count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from("parent_notifications")
        .select("*", { count: "exact", head: true })
        .eq("parent_id", user.id)
        .eq("is_read", false);
      
      if (error) {
        console.error("Error fetching unread count:", error);
        return 0;
      }
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get the correct path based on domain
  const getNavPath = (item: { path: string; altPath: string }) => 
    isPortalDomain ? item.path : item.altPath;
  
  const messagesPath = isPortalDomain ? "/messages" : "/portal/messages";
  const authPath = isPortalDomain ? "/auth" : "/portal/auth";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(authPath, { replace: true });
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  const isPathActive = (item: { path: string; altPath: string }) => {
    return location.pathname === item.path || location.pathname === item.altPath;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Ghost Mode Banner */}
      <ParentGhostModeBanner />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground text-sm">
                {title || "Parent Portal"}
              </h1>
            </div>
          </div>
          
          {/* Desktop: show all nav items */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              {mainNavItems.map((item) => {
                const isActive = isPathActive(item);
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => navigate(getNavPath(item))}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
              {menuItems.map((item) => {
                const isActive = isPathActive(item);
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => navigate(getNavPath(item))}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
              {/* Messages with badge */}
              <Button
                variant={location.pathname === messagesPath || location.pathname === "/portal/messages" || location.pathname === "/messages" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigate(messagesPath)}
                className="gap-2 relative"
              >
                <Bell className="h-4 w-4" />
                Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className="text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* Mobile: bell icon + burger menu */}
          {isMobile && (
            <div className="flex items-center gap-1">
              {/* Messages bell with badge */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 relative"
                onClick={() => navigate(messagesPath)}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
              
              {/* Burger menu */}
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-2 mt-6">
                    {menuItems.map((item) => {
                      const isActive = isPathActive(item);
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.path}
                          variant={isActive ? "secondary" : "ghost"}
                          className="justify-start gap-3 h-12 text-base"
                          onClick={() => handleNavigate(getNavPath(item))}
                        >
                          <Icon className="h-5 w-5" />
                          {item.label}
                        </Button>
                      );
                    })}
                    <div className="border-t border-border my-4" />
                    <Button 
                      variant="ghost" 
                      className="justify-start gap-3 h-12 text-base text-destructive hover:text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-5 w-5" />
                      Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile only, simplified */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-50">
          <div className="max-w-4xl mx-auto flex justify-around py-2">
            {mainNavItems.map((item) => {
              const isActive = isPathActive(item);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(getNavPath(item))}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
