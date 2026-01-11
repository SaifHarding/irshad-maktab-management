import { Button } from "@/components/ui/button";
import { useGhostMode } from "@/contexts/GhostModeContext";
import { Ghost, X } from "lucide-react";

const GhostModeBanner = () => {
  const { ghostUser, isGhostMode, exitGhostMode } = useGhostMode();

  if (!isGhostMode || !ghostUser) return null;

  return (
    <div className="sticky top-0 z-50 bg-purple-600 text-white px-4 py-2 flex items-center justify-between safe-top">
      <div className="flex items-center gap-2">
        <Ghost className="w-5 h-5" />
        <span className="text-sm font-medium">
          Ghost Mode: <strong>{ghostUser.full_name}</strong>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={exitGhostMode}
        className="text-white hover:bg-purple-700 hover:text-white h-8 px-2"
      >
        <X className="w-4 h-4 mr-1" />
        Exit
      </Button>
    </div>
  );
};

export default GhostModeBanner;
