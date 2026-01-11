import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Student } from "@/hooks/useStudents";
import { X, FileDown } from "lucide-react";

export type TimePeriod = "30" | "60" | "90" | "180" | "365" | "all";

interface AttendanceFiltersProps {
  period: TimePeriod;
  teacher: string;
  studentId: string;
  students: Student[];
  onPeriodChange: (period: TimePeriod) => void;
  onTeacherChange: (teacher: string) => void;
  onStudentChange: (studentId: string) => void;
  onReset: () => void;
  onDownloadCSV: () => void;
}

const AttendanceFilters = ({
  period,
  teacher,
  studentId,
  students,
  onPeriodChange,
  onTeacherChange,
  onStudentChange,
  onReset,
  onDownloadCSV,
}: AttendanceFiltersProps) => {
  const hasFilters = period !== "all" || teacher !== "all" || studentId !== "all";

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="period">Time Period</Label>
            <Select value={period} onValueChange={onPeriodChange}>
              <SelectTrigger id="period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="180">Last 6 months</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher">Teacher</Label>
            <Select value={teacher} onValueChange={onTeacherChange}>
              <SelectTrigger id="teacher">
                <SelectValue placeholder="All teachers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers</SelectItem>
                <SelectItem value="Nurulain">Nurulain</SelectItem>
                <SelectItem value="Amna">Amna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="student">Student</Label>
            <Select value={studentId} onValueChange={onStudentChange}>
              <SelectTrigger id="student">
                <SelectValue placeholder="All students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {hasFilters && (
            <Button onClick={onReset} variant="outline" size="lg" className="h-14 text-lg touch-manipulation">
              <X className="w-5 h-5 mr-2" />
              Clear Filters
            </Button>
          )}
          <Button 
            onClick={onDownloadCSV}
            variant="outline"
            size="lg" 
            className="h-14 text-lg touch-manipulation"
          >
            <FileDown className="w-5 h-5 mr-2" />
            Download CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceFilters;
