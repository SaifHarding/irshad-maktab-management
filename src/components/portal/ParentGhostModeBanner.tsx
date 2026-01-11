import { Button } from "@/components/ui/button";
import { useParentGhostMode } from "@/contexts/ParentGhostModeContext";
import { Ghost, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { paths } from "@/lib/portalPaths";

const ParentGhostModeBanner = () => {
  const { ghostParent, isGhostMode, exitGhostMode } = useParentGhostMode();
  const navigate = useNavigate();

  if (!isGhostMode || !ghostParent) return null;

  const handleExit = () => {
    exitGhostMode();
    // Navigate back to portal management
    navigate(paths.adminPortal());
  };

  return (
    <div className="sticky top-0 z-50 bg-purple-600 text-white px-4 py-2 flex items-center justify-between safe-top">
      <div className="flex items-center gap-2">
        <Ghost className="w-5 h-5" />
        <span className="text-sm font-medium">
          Viewing as: <strong>{ghostParent.full_name || ghostParent.email}</strong>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExit}
        className="text-white hover:bg-purple-700 hover:text-white h-8 px-2"
      >
        <X className="w-4 h-4 mr-1" />
        Exit Ghost Mode
      </Button>
    </div>
  );
};

export default ParentGhostModeBanner;
