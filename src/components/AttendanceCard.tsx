import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, XCircle, Edit, Trash2, Save, ChevronLeft } from "lucide-react";
import { Student } from "@/hooks/useStudents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getGroupLabel, type GroupCode } from "@/lib/groups";

interface AttendanceCardProps {
  student: Student;
  currentIndex: number;
  totalStudents: number;
  onMarkAttendance: (status: "attended" | "skipped") => void;
  onCancel: () => void;
  onGoBack?: () => void;
  onRemoveStudent: (studentId: string) => void;
  onReassignStudent?: (studentId: string, newGroup: string) => void;
  onUpdateStudentName?: (studentId: string, newName: string) => void;
  maktab?: "boys" | "girls";
  currentGroup?: string;
  availableGroups?: readonly GroupCode[];
}

const AttendanceCard = ({
  student,
  currentIndex,
  totalStudents,
  onMarkAttendance,
  onCancel,
  onGoBack,
  onRemoveStudent,
  onReassignStudent,
  onUpdateStudentName,
  maktab,
  currentGroup,
  availableGroups = [],
}: AttendanceCardProps) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [editedName, setEditedName] = useState(student.name);
  const [isEditingName, setIsEditingName] = useState(false);

  const otherGroups = availableGroups.filter(g => g !== currentGroup);
  const canReassign = otherGroups.length > 0 && onReassignStudent;

  // Reset state when student changes
  useEffect(() => {
    setEditedName(student.name);
    setIsEditingName(false);
  }, [student.id, student.name]);

  const handleReassign = () => {
    if (selectedGroup && onReassignStudent) {
      onReassignStudent(student.id, selectedGroup);
      setEditDialogOpen(false);
      setSelectedGroup("");
    }
  };

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== student.name && onUpdateStudentName) {
      onUpdateStudentName(student.id, editedName.trim());
      setEditDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 safe-top safe-bottom relative overflow-hidden">
      <div className="w-full space-y-12 animate-fade-in">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-2">
            {currentIndex > 0 && onGoBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onGoBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </Button>
            )}
            <p className="text-muted-foreground text-2xl">
              Student {currentIndex + 1} of {totalStudents}
            </p>
          </div>
          <h2 className="text-6xl font-bold text-foreground break-words leading-tight px-4">
            {student.name}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Button
            onClick={() => onMarkAttendance("skipped")}
            size="lg"
            variant="destructive"
            className="h-48 flex-col gap-4 touch-manipulation active:scale-95 transition-transform"
          >
            <X className="w-16 h-16" />
            <span className="text-3xl font-semibold">Absent</span>
          </Button>

          <Button
            onClick={() => onMarkAttendance("attended")}
            size="lg"
            className="h-48 flex-col gap-4 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white touch-manipulation active:scale-95 transition-transform"
          >
            <Check className="w-16 h-16" />
            <span className="text-3xl font-semibold">Present</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="lg"
                variant="outline"
                className="h-20 flex-col gap-2 touch-manipulation"
              >
                <XCircle className="w-8 h-8" />
                <span className="text-lg font-medium">Cancel</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl p-6">
              <AlertDialogHeader className="space-y-4">
                <AlertDialogTitle className="text-2xl font-bold text-center">Cancel Attendance Session</AlertDialogTitle>
                <AlertDialogDescription className="text-base text-center leading-relaxed">
                  Are you sure you want to cancel? All progress will be lost and you'll need to start over.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col gap-3 sm:flex-row mt-6">
                <AlertDialogCancel className="h-14 text-lg w-full touch-manipulation">No, Continue</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onCancel}
                  className="h-14 text-lg w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 touch-manipulation"
                >
                  Yes, Cancel
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                variant="outline"
                className="h-20 flex-col gap-2 touch-manipulation"
              >
                <Edit className="w-8 h-8" />
                <span className="text-lg font-medium">Edit Student</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md rounded-2xl p-6">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-2xl font-bold text-center">Edit Student</DialogTitle>
                <DialogDescription className="text-base text-center">
                  {student.name}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 mt-6">
                {onUpdateStudentName && (
                  <div className="space-y-3">
                    <label className="text-lg font-medium">Student Name</label>
                    {!isEditingName ? (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingName(true)}
                        className="w-full h-14 text-lg justify-start"
                      >
                        <Edit className="w-5 h-5 mr-2" />
                        Edit Name
                      </Button>
                    ) : (
                      <>
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="h-14 text-lg"
                          placeholder="Enter student name..."
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditingName(false);
                              setEditedName(student.name);
                            }}
                            className="flex-1 h-14 text-lg"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveName}
                            disabled={!editedName.trim() || editedName === student.name}
                            className="flex-1 h-14 text-lg"
                          >
                            <Save className="w-5 h-5 mr-2" />
                            Save
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {canReassign && (
                  <div className="space-y-3">
                    <label className="text-lg font-medium">Reassign to Group</label>
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                      <SelectTrigger className="h-14 text-lg">
                        <SelectValue placeholder="Select group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {otherGroups.map((group) => (
                          <SelectItem key={group} value={group} className="text-lg py-3">
                            {getGroupLabel(group)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleReassign}
                      disabled={!selectedGroup}
                      className="w-full h-14 text-lg"
                    >
                      Reassign Student
                    </Button>
                  </div>
                )}

                <div className="border-t pt-6">
                  {!showRemoveConfirm ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowRemoveConfirm(true)}
                      className="w-full h-14 text-lg text-destructive hover:text-destructive border-destructive/50 hover:bg-destructive/10"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Remove Student
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Remove {student.name}? Their attendance history will be preserved.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setShowRemoveConfirm(false)}
                          className="h-12"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            onRemoveStudent(student.id);
                            setEditDialogOpen(false);
                          }}
                          className="h-12"
                        >
                          Yes, Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCard;
