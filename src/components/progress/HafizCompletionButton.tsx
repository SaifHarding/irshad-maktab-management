import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
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
import { triggerHafizConfetti } from "@/lib/confetti";

interface HafizCompletionButtonProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const HafizCompletionButton = ({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: HafizCompletionButtonProps) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    if (checked) {
      onCheckedChange(false);
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    onCheckedChange(true);
    setShowConfirm(false);
    triggerHafizConfetti();
  };

  return (
    <>
      <Button
        type="button"
        variant={checked ? "default" : "outline"}
        size="lg"
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "h-14 w-full gap-2 transition-all text-base",
          checked 
            ? "bg-green-600 hover:bg-green-700 text-white border-green-600" 
            : "border-green-400 text-green-700 hover:bg-green-50 hover:border-green-500 dark:text-green-400 dark:hover:bg-green-950/30",
          className
        )}
      >
        <GraduationCap className={cn("h-5 w-5", checked && "fill-current")} />
        <span className="font-medium">{checked ? "Hafiz ✓" : "Mark as Hafiz"}</span>
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Mark Student as Hafiz?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              This is a significant milestone! The student will be marked as having completed their Hifz journey. You can undo this if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel className="h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="h-12 bg-green-600 hover:bg-green-700"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              Yes, Mark as Hafiz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};