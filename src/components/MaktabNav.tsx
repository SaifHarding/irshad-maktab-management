import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Menu, Users, BarChart3, LogOut, Sun, Moon, Monitor, ClipboardList } from "lucide-react";
import { useTheme } from "next-themes";
import { performLogout } from "@/lib/sessionManager";
import { toast } from "@/hooks/use-toast";
import { paths } from "@/lib/portalPaths";

interface MaktabNavProps {
  maktab: "boys" | "girls";
  isAdmin: boolean;
  currentPage?: "attendance" | "students" | "history";
}

export const MaktabNav = ({ maktab, isAdmin, currentPage }: MaktabNavProps) => {
  const { theme, setTheme } = useTheme();

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

  const getThemeIcon = () => {
    if (theme === "light") return <Sun className="h-5 w-5" />;
    if (theme === "dark") return <Moon className="h-5 w-5" />;
    return <Monitor className="h-5 w-5" />;
  };

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const getThemeLabel = () => {
    if (theme === "light") return "Light";
    if (theme === "dark") return "Dark";
    return "System";
  };

  return (
    <div className="flex items-center justify-between mb-4 py-2">
      {/* Left side - Home icon for admins */}
      <div className="w-12">
        {isAdmin && (
          <Link to={paths.home()}>
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <Home className="!h-6 !w-6" />
            </Button>
          </Link>
        )}
      </div>

      {/* Right side - Burger menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-12 w-12">
            <Menu className="!h-6 !w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-2">
          {currentPage !== "attendance" && (
            <DropdownMenuItem asChild className="h-12 text-base">
              <Link to={paths.maktab(maktab)} className="flex items-center gap-3 cursor-pointer px-3">
                <ClipboardList className="h-5 w-5" />
                Attendance
              </Link>
            </DropdownMenuItem>
          )}
          {currentPage !== "students" && (
            <DropdownMenuItem asChild className="h-12 text-base">
              <Link to={paths.maktabStudents(maktab)} className="flex items-center gap-3 cursor-pointer px-3">
                <Users className="h-5 w-5" />
                Students
              </Link>
            </DropdownMenuItem>
          )}
          {currentPage !== "history" && (
            <DropdownMenuItem asChild className="h-12 text-base">
              <Link to={paths.maktabDashboard(maktab)} className="flex items-center gap-3 cursor-pointer px-3">
                <BarChart3 className="h-5 w-5" />
                History
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem onClick={cycleTheme} className="h-12 text-base flex items-center gap-3 cursor-pointer px-3">
            {getThemeIcon()}
            Theme: {getThemeLabel()}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-2" />
          <DropdownMenuItem onClick={handleLogout} className="h-12 text-base flex items-center gap-3 cursor-pointer px-3 text-destructive focus:text-destructive">
            <LogOut className="h-5 w-5" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
