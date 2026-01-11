import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { LogOut, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import logo from "@/assets/masjid-logo.png";
import { performLogout } from "@/lib/sessionManager";
import { useGhostMode } from "@/contexts/GhostModeContext";
import GhostModeBanner from "@/components/GhostModeBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { paths } from "@/lib/portalPaths";

const Home = () => {
  const navigate = useNavigate();
  const { isGhostMode } = useGhostMode();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserAccess();
  }, []);

  const checkUserAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate(paths.auth());
      return;
    }

    // Get user's profile and roles
    const { data: profile } = await supabase
      .from("profiles")
      .select("maktab")
      .eq("id", user.id)
      .single();

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const userRoles = roles?.map(r => r.role) || [];
    const hasAdminRole = userRoles.includes("admin");
    const hasTeacherRole = userRoles.includes("teacher");

    setIsAdmin(hasAdminRole);

    // If user is ONLY a teacher (not also an admin), redirect to their maktab
    if (hasTeacherRole && !hasAdminRole && profile?.maktab) {
      navigate(paths.maktab(profile.maktab));
      return;
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    const { error } = await performLogout();
    if (error) {
      toast({
        title: "Logout Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    }
  };

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

  return (
    <div className="min-h-screen bg-background flex flex-col safe-top safe-bottom">
      <GhostModeBanner />

      <div className="relative flex-1 flex flex-col items-center justify-center px-3 py-4 sm:p-4">
        <div className="absolute top-4 right-3 sm:right-4 flex gap-2">
          <ThemeToggle />
          {isAdmin && (
            <Link to={paths.admin()}>
              <Button variant="outline" size="sm" className="gap-2 h-10">
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2 h-10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>

        <div className="space-y-6 sm:space-y-8 w-full max-w-md">
          <div className="text-center space-y-4 sm:space-y-6">
            <img src={logo} alt="Masjid Logo" className="w-32 h-32 sm:w-40 sm:h-40 mx-auto" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">Maktab Attendance</h1>
            <p className="text-muted-foreground text-lg sm:text-xl">Select a class to begin</p>
          </div>

          <div className="w-full">
            <Link to={paths.maktab("girls")} className="block mb-6 sm:mb-8">
              <Button
                size="lg"
                className="w-full h-20 sm:h-28 text-2xl sm:text-3xl font-semibold touch-manipulation active:scale-95 transition-transform bg-pink-100 hover:bg-pink-200 text-pink-900 border-2 border-pink-300"
              >
                Girls Maktab
              </Button>
            </Link>

            <Link to={paths.maktab("boys")} className="block">
              <Button
                size="lg"
                className="w-full h-20 sm:h-28 text-2xl sm:text-3xl font-semibold touch-manipulation active:scale-95 transition-transform"
              >
                Boys Maktab
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
