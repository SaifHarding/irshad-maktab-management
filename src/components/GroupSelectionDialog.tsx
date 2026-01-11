import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { getGroupLabel, GroupCode } from "@/lib/groups";

interface GroupSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableGroups: GroupCode[];
  onSelectGroups: (groups: GroupCode[]) => void;
  onCancel: () => void;
  teacherName: string;
}

const GroupSelectionDialog = ({
  open,
  onOpenChange,
  availableGroups,
  onSelectGroups,
  onCancel,
  teacherName,
}: GroupSelectionDialogProps) => {
  const [selectedGroups, setSelectedGroups] = useState<GroupCode[]>([]);

  const handleToggleGroup = (group: GroupCode) => {
    setSelectedGroups((prev) =>
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  };

  const handleSelectAll = () => {
    onSelectGroups(availableGroups);
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (selectedGroups.length > 0) {
      onSelectGroups(selectedGroups);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[95vw] max-w-md" 
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Select Groups</DialogTitle>
          <DialogDescription className="text-base">
            Hi {teacherName}, which groups would you like to log attendance for today?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {availableGroups.map((group) => (
            <div
              key={group}
              className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                id={group}
                checked={selectedGroups.includes(group)}
                onCheckedChange={() => handleToggleGroup(group)}
                className="h-6 w-6"
              />
              <Label
                htmlFor={group}
                className="flex-1 text-lg font-medium cursor-pointer"
              >
                {getGroupLabel(group)}
              </Label>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleSelectAll}
            size="lg"
            className="w-full h-14 text-lg"
          >
            Continue with All Groups
          </Button>
          <Button
            onClick={handleContinue}
            variant="outline"
            size="lg"
            className="w-full h-14 text-lg"
            disabled={selectedGroups.length === 0}
          >
            Continue with Selected ({selectedGroups.length})
          </Button>
          <Button
            onClick={onCancel}
            variant="ghost"
            size="lg"
            className="w-full h-12 text-base text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupSelectionDialog;
