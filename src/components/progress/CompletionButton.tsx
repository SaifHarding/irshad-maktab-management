import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { triggerMilestoneConfetti } from "@/lib/confetti";

interface CompletionButtonProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const CompletionButton = ({
  label,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: CompletionButtonProps) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    if (checked) {
      // Allow unchecking without confirmation
      onCheckedChange(false);
    } else {
      // Show confirmation before marking as complete
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    onCheckedChange(true);
    setShowConfirm(false);
    triggerMilestoneConfetti();
  };

  return (
    <>
      <Button
        type="button"
        variant={checked ? "default" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "h-10 px-3 gap-1.5 transition-all",
          checked 
            ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" 
            : "border-amber-400 text-amber-600 hover:bg-amber-50 hover:border-amber-500",
          className
        )}
      >
        <Crown className={cn("h-4 w-4", checked && "fill-current")} />
        <span className="font-medium">{checked ? "Completed" : "Done"}</span>
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Mark {label} as Complete?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the student as having completed {label}. You can undo this if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="h-12 bg-amber-500 hover:bg-amber-600"
            >
              <Crown className="h-4 w-4 mr-2" />
              Yes, Mark Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
