import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Pencil, Lock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";

interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: "attended" | "skipped";
}

interface AttendanceSummaryProps {
  teacher: string;
  date: Date;
  records: AttendanceRecord[];
  onToggleStatus: (studentId: string) => void;
  onComplete: () => void;
  isSubmitting: boolean;
}

const AttendanceSummary = ({
  teacher,
  date,
  records,
  onToggleStatus,
  onComplete,
  isSubmitting,
}: AttendanceSummaryProps) => {
  const [editMode, setEditMode] = useState(false);
  const presentCount = records.filter((r) => r.status === "attended").length;
  const absentCount = records.filter((r) => r.status === "skipped").length;

  return (
    <div className="min-h-screen bg-background p-4 safe-top safe-bottom relative">
      {/* Submitting overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <p className="text-2xl font-semibold">Saving Attendance...</p>
            <p className="text-muted-foreground">Please wait while we record the attendance</p>
          </div>
          <div className="w-64">
            <Progress value={66} className="h-2 animate-pulse" />
          </div>
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl">Attendance Summary</CardTitle>
                <p className="text-muted-foreground text-lg">
                  {teacher} • {format(date, "MMMM d, yyyy")}
                </p>
              </div>
              <Button
                variant={editMode ? "default" : "outline"}
                size="lg"
                onClick={() => setEditMode(!editMode)}
                className="gap-2 h-14 px-5"
                disabled={isSubmitting}
              >
                {editMode ? (
                  <>
                    <Lock className="w-5 h-5" />
                    <span className="text-lg">Lock</span>
                  </>
                ) : (
                  <>
                    <Pencil className="w-5 h-5" />
                    <span className="text-lg">Edit</span>
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-6 text-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-600 rounded-full" />
                <span>Present: {presentCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-destructive rounded-full" />
                <span>Absent: {absentCount}</span>
              </div>
            </div>

            {!editMode && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Tap "Edit" to make changes
              </p>
            )}

            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.studentId}
                  onClick={() => editMode && !isSubmitting && onToggleStatus(record.studentId)}
                  className={`w-full flex items-center justify-between p-5 rounded-lg border bg-card transition-colors ${
                    editMode && !isSubmitting
                      ? "cursor-pointer hover:bg-accent active:bg-accent/80 touch-manipulation" 
                      : "cursor-default opacity-90"
                  }`}
                >
                  <span className="font-medium text-xl">{record.studentName}</span>
                  {record.status === "attended" ? (
                    <div className="flex items-center gap-3 text-green-600">
                      <Check className="w-6 h-6" />
                      <span className="text-lg font-semibold">Present</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-destructive">
                      <X className="w-6 h-6" />
                      <span className="text-lg font-semibold">Absent</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Button
            onClick={() => onComplete()}
            className="w-full h-20 text-2xl touch-manipulation gap-3"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                Saving...
              </>
            ) : (
              "Complete Attendance"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSummary;