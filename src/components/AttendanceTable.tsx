import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSaveStarStudents } from "@/hooks/useStarStudents";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { AttendanceHistoryRecord } from "@/hooks/useAttendanceHistory";
import { useUpdateAttendance } from "@/hooks/useUpdateAttendance";
import { useDeleteAttendance } from "@/hooks/useDeleteAttendance";
import { useDeleteDayAttendance } from "@/hooks/useDeleteDayAttendance";
import { useAttendance } from "@/hooks/useAttendance";
import { Student } from "@/hooks/useStudents";
import { getGroupShortLabel } from "@/lib/groups";
import { Check, X, Edit2, Trash2, CalendarX, ChevronDown, Trophy, Star, UserX } from "lucide-react";

interface AttendanceTableProps {
  records: AttendanceHistoryRecord[];
  isLoading: boolean;
  maktab?: string;
  students?: Student[];
}

const AttendanceTable = ({ records, isLoading, maktab = "girls", students = [] }: AttendanceTableProps) => {
  const { updateAttendance, isUpdating } = useUpdateAttendance();
  const { deleteAttendance } = useDeleteAttendance();
  const { mutate: deleteDayAttendance } = useDeleteDayAttendance();
  const { mutate: saveStarStudents } = useSaveStarStudents();
  
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = format(new Date(), "MMMM yyyy");
  
  const [pendingUpdate, setPendingUpdate] = useState<{
    id: string;
    currentStatus: string;
    studentName: string;
    date: string;
  } | null>(null);

  // Compute grouped data for initializing state hooks
  const recordsByDate = records.reduce((acc, record) => {
    const date = record.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, AttendanceHistoryRecord[]>);

  const sortedDates = Object.keys(recordsByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const datesByMonth = sortedDates.reduce((acc, date) => {
    const monthKey = format(new Date(date), "MMMM yyyy");
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(date);
    return acc;
  }, {} as Record<string, string[]>);

  const sortedMonths = Object.keys(datesByMonth).sort((a, b) => {
    const dateA = new Date(datesByMonth[a][0] || new Date());
    const dateB = new Date(datesByMonth[b][0] || new Date());
    return dateB.getTime() - dateA.getTime();
  });

  const monthsByYear = sortedMonths.reduce((acc, month) => {
    const year = month.split(" ")[1];
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(month);
    return acc;
  }, {} as Record<string, string[]>);

  const sortedYears = Object.keys(monthsByYear).sort((a, b) => parseInt(b) - parseInt(a));

  // All useState hooks MUST be before any early returns
  const [openYears, setOpenYears] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sortedYears.forEach(year => {
      initial[year] = year === currentYear;
    });
    return initial;
  });

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sortedMonths.forEach(month => {
      initial[month] = month === currentMonth;
    });
    return initial;
  });

  // State for star students dialog - MUST be before early returns
  const [showStarStudentsDialog, setShowStarStudentsDialog] = useState(false);

  // Calculate total high attendance days and star students with 100% (current month only)
  const { totalHighAttendanceDays, starStudents } = useMemo(() => {
    if (records.length === 0) {
      return { totalHighAttendanceDays: 0, starStudents: [] };
    }
    
    let totalHigh = 0;
    
    for (const date of sortedDates) {
      const dayRecords = recordsByDate[date];
      // Exclude Hifz (Group C) students from gold day calculation
      const nonHifzRecords = dayRecords.filter(r => r.student_group !== 'C');
      const present = nonHifzRecords.filter(r => r.status === "attended").length;
      const total = nonHifzRecords.length;
      const percentage = total > 0 ? (present / total) * 100 : 0;
      
      if (percentage >= 90) {
        totalHigh++;
      }
    }

    // Calculate star students (100% attendance - current month only)
    const currentMonthRecords = records.filter(r => {
      const recordMonth = format(new Date(r.date), "MMMM yyyy");
      return recordMonth === currentMonth;
    });

    const studentStats: Record<string, { id: string; name: string; present: number; total: number }> = {};
    currentMonthRecords.forEach(r => {
      if (!studentStats[r.student_id]) {
        studentStats[r.student_id] = { id: r.student_id, name: r.student_name, present: 0, total: 0 };
      }
      studentStats[r.student_id].total++;
      if (r.status === "attended") {
        studentStats[r.student_id].present++;
      }
    });

    // Get all students with 100% attendance (minimum 3 records to qualify)
    const perfectStudents: { id: string; name: string; percentage: number }[] = [];
    Object.values(studentStats).forEach(stat => {
      if (stat.total >= 3) {
        const pct = (stat.present / stat.total) * 100;
        if (pct === 100) {
          perfectStudents.push({ id: stat.id, name: stat.name, percentage: pct });
        }
      }
    });

    // Sort alphabetically
    perfectStudents.sort((a, b) => a.name.localeCompare(b.name));

    return { totalHighAttendanceDays: totalHigh, starStudents: perfectStudents };
  }, [sortedDates, recordsByDate, records, currentMonth]);

  // Save star students snapshot at the end of the month - MUST be before early returns
  useEffect(() => {
    if (starStudents.length === 0) return;
    
    // Check if we're in the last week of the month (to capture end-of-month data)
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const isLastWeek = today.getDate() > lastDayOfMonth - 7;
    
    if (isLastWeek) {
      const studentIds = starStudents.map(s => s.id);
      saveStarStudents({
        studentIds,
        maktab,
        month: currentMonth,
      });
    }
  }, [starStudents, currentMonth, maktab, saveStarStudents]);

  const handleToggleStatus = (record: AttendanceHistoryRecord) => {
    setPendingUpdate({
      id: record.id,
      currentStatus: record.status,
      studentName: record.student_name,
      date: record.date,
    });
  };

  const confirmUpdate = () => {
    if (!pendingUpdate) return;
    
    const newStatus = pendingUpdate.currentStatus === "attended" ? "skipped" : "attended";
    updateAttendance({ 
      id: pendingUpdate.id, 
      status: newStatus,
    });
    setPendingUpdate(null);
  };

  const handleDelete = (recordId: string) => {
    deleteAttendance(recordId);
  };

  const handleDeleteDay = (date: string) => {
    deleteDayAttendance(date);
  };

  const toggleYear = (year: string) => {
    setOpenYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  const toggleMonth = (month: string) => {
    setOpenMonths(prev => ({ ...prev, [month]: !prev[month] }));
  };

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No attendance records found
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPresent = records.filter((r) => r.status === "attended").length;
  const totalAbsent = records.filter((r) => r.status === "skipped").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Days Recorded ({sortedDates.length})</CardTitle>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-400/50">
            <Trophy className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
              {totalHighAttendanceDays} gold day{totalHighAttendanceDays !== 1 ? 's' : ''}
            </span>
          </div>
          {starStudents.length > 0 && (
            starStudents.length <= 3 ? (
              // Show all star students if 3 or fewer
              <div className="flex flex-wrap items-center gap-2">
                {starStudents.map((student, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/50"
                  >
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    <span className="font-bold text-lg text-yellow-600 dark:text-yellow-400">
                      {student.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              // Show count button if more than 3
              <button
                onClick={() => setShowStarStudentsDialog(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/50 hover:from-yellow-500/30 hover:to-amber-500/30 transition-colors touch-manipulation"
              >
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                <span className="font-bold text-lg text-yellow-600 dark:text-yellow-400">
                  {starStudents.length} Star Students
                </span>
              </button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedYears.map((year) => {
            const yearMonths = monthsByYear[year];
            const yearDates = yearMonths.flatMap(month => datesByMonth[month]);
            const yearRecords = yearDates.flatMap(date => recordsByDate[date]);
            const yearPresent = yearRecords.filter(r => r.status === "attended").length;
            const yearAbsent = yearRecords.filter(r => r.status === "skipped").length;
            const yearGoldDays = yearDates.filter(date => {
              const dayRecords = recordsByDate[date];
              // Exclude Hifz (Group C) students from gold day calculation
              const nonHifzRecords = dayRecords.filter(r => r.student_group !== 'C');
              const present = nonHifzRecords.filter(r => r.status === "attended").length;
              const total = nonHifzRecords.length;
              return total > 0 && (present / total) * 100 >= 90;
            }).length;
            const isCurrentYear = year === currentYear;
            const showYearHeader = sortedYears.length > 1 || year !== currentYear;

            return (
              <div key={year}>
                {showYearHeader ? (
                  <Collapsible open={openYears[year]} onOpenChange={() => toggleYear(year)}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg mb-3 touch-manipulation">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-5 h-5 transition-transform ${openYears[year] ? '' : '-rotate-90'}`} />
                        <h2 className="text-2xl font-bold text-foreground">{year}</h2>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{yearMonths.length} months</span>
                        {yearGoldDays > 0 && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Trophy className="w-4 h-4" />
                            {yearGoldDays}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-success">
                          <Check className="w-4 h-4" />
                          {yearPresent}
                        </span>
                        <span className="flex items-center gap-1 text-destructive">
                          <X className="w-4 h-4" />
                          {yearAbsent}
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4 pl-2">
                        {yearMonths.map((month) => (
                          <MonthSection
                            key={month}
                            month={month}
                            dates={datesByMonth[month]}
                            recordsByDate={recordsByDate}
                            isOpen={openMonths[month]}
                            onToggle={() => toggleMonth(month)}
                            onDeleteDay={handleDeleteDay}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDelete}
                            isUpdating={isUpdating}
                            students={students}
                            maktab={maktab}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <div className="space-y-4">
                    {yearMonths.map((month) => (
                      <MonthSection
                        key={month}
                        month={month}
                        dates={datesByMonth[month]}
                        recordsByDate={recordsByDate}
                        isOpen={openMonths[month]}
                        onToggle={() => toggleMonth(month)}
                        onDeleteDay={handleDeleteDay}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDelete}
                        isUpdating={isUpdating}
                        students={students}
                        maktab={maktab}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Confirmation dialog for status update */}
      <AlertDialog open={!!pendingUpdate} onOpenChange={(open) => !open && setPendingUpdate(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl p-6">
          <AlertDialogHeader className="space-y-4">
            <AlertDialogTitle className="text-2xl font-bold text-center">
              Confirm Status Change
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-center leading-relaxed">
              Change <span className="font-semibold">{pendingUpdate?.studentName}</span>'s attendance 
              from <span className="font-semibold">{pendingUpdate?.currentStatus === "attended" ? "Present" : "Absent"}</span> to{" "}
              <span className="font-semibold">{pendingUpdate?.currentStatus === "attended" ? "Absent" : "Present"}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-3 sm:flex-row mt-6">
            <AlertDialogCancel className="h-14 text-lg w-full touch-manipulation">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUpdate}
              className="h-14 text-lg w-full touch-manipulation"
              disabled={isUpdating}
            >
              {isUpdating ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Star Students Dialog */}
      <Dialog open={showStarStudentsDialog} onOpenChange={setShowStarStudentsDialog}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              Star Students
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center text-muted-foreground mb-4">
              Students with 100% attendance this month
            </p>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {starStudents.map((student) => (
                <div 
                  key={student.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-400/30"
                >
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  <span className="font-medium text-foreground">{student.name}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// Extracted MonthSection component for cleaner code
interface MonthSectionProps {
  month: string;
  dates: string[];
  recordsByDate: Record<string, AttendanceHistoryRecord[]>;
  isOpen: boolean;
  onToggle: () => void;
  onDeleteDay: (date: string) => void;
  onToggleStatus: (record: AttendanceHistoryRecord) => void;
  onDelete: (recordId: string) => void;
  isUpdating: boolean;
  students: Student[];
  maktab: string;
}

const MonthSection = ({
  month,
  dates,
  recordsByDate,
  isOpen,
  onToggle,
  onDeleteDay,
  onToggleStatus,
  onDelete,
  isUpdating,
  students,
  maktab,
}: MonthSectionProps) => {
  const monthRecords = dates.flatMap(date => recordsByDate[date]);
  const monthPresent = monthRecords.filter(r => r.status === "attended").length;
  const monthAbsent = monthRecords.filter(r => r.status === "skipped").length;
  const monthGoldDays = dates.filter(date => {
    const dayRecords = recordsByDate[date];
    // Exclude Hifz (Group C) students from gold day calculation
    const nonHifzRecords = dayRecords.filter(r => r.student_group !== 'C');
    const present = nonHifzRecords.filter(r => r.status === "attended").length;
    const total = nonHifzRecords.length;
    return total > 0 && (present / total) * 100 >= 90;
  }).length;
  const monthName = month.split(" ")[0];

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 border rounded-lg bg-card touch-manipulation">
        <div className="flex items-center gap-3">
          <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          <h3 className="text-xl font-semibold text-foreground">{monthName}</h3>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{dates.length} days</span>
          {monthGoldDays > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Trophy className="w-4 h-4" />
              {monthGoldDays}
            </span>
          )}
          <span className="flex items-center gap-1 text-success">
            <Check className="w-4 h-4" />
            {monthPresent}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <X className="w-4 h-4" />
            {monthAbsent}
          </span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">
          <Accordion type="single" collapsible className="space-y-2">
            {dates.map((date) => (
              <DayAccordionItem
                key={date}
                date={date}
                dayRecords={recordsByDate[date]}
                onDeleteDay={onDeleteDay}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
                isUpdating={isUpdating}
                students={students}
                maktab={maktab}
              />
            ))}
          </Accordion>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Extracted DayAccordionItem component
interface DayAccordionItemProps {
  date: string;
  dayRecords: AttendanceHistoryRecord[];
  onDeleteDay: (date: string) => void;
  onToggleStatus: (record: AttendanceHistoryRecord) => void;
  onDelete: (recordId: string) => void;
  isUpdating: boolean;
  students: Student[];
  maktab: string;
}

const DayAccordionItem = ({
  date,
  dayRecords,
  onDeleteDay,
  onToggleStatus,
  onDelete,
  isUpdating,
  students,
  maktab,
}: DayAccordionItemProps) => {
  const { submitAttendance, isSubmitting } = useAttendance(maktab as "boys" | "girls");
  const [markingStudent, setMarkingStudent] = useState<string | null>(null);
  const [expandedUnmarkedGroups, setExpandedUnmarkedGroups] = useState<Record<string, boolean>>({});
  const [showUnmarked, setShowUnmarked] = useState(false);

  // Calculate unmarked students for this specific date
  const unmarkedStudentsByGroup = useMemo(() => {
    const markedStudentIds = new Set(dayRecords.map(r => r.student_id));
    const recordDate = new Date(date);
    
    // Only include students who were enrolled on or before this date
    const unmarkedStudents = students.filter(s => {
      if (markedStudentIds.has(s.id)) return false;
      
      // Check if student was enrolled by this date
      const studentCreatedAt = new Date(s.created_at);
      // Compare just the date parts (ignore time)
      const studentJoinDate = new Date(studentCreatedAt.getFullYear(), studentCreatedAt.getMonth(), studentCreatedAt.getDate());
      const attendanceDate = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
      
      return studentJoinDate <= attendanceDate;
    });
    
    const grouped: Record<string, Student[]> = {};
    unmarkedStudents.forEach(student => {
      const group = student.student_group || "Unassigned";
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(student);
    });
    
    Object.keys(grouped).forEach(group => {
      grouped[group].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    return grouped;
  }, [students, dayRecords, date]);

  const totalUnmarked = Object.values(unmarkedStudentsByGroup).reduce(
    (sum, group) => sum + group.length, 
    0
  );

  const toggleUnmarkedGroup = (group: string) => {
    setExpandedUnmarkedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleMarkAttendance = async (student: Student, status: "attended" | "skipped") => {
    setMarkingStudent(student.id);
    const teacher = dayRecords[0]?.teacher_name || "Admin";
    
    try {
      submitAttendance({
        records: [{
          student_id: student.id,
          status,
          teacher_name: teacher,
          date,
          maktab,
        }],
        forceUpdate: false,
      });
    } finally {
      setMarkingStudent(null);
    }
  };

  // Exclude Hifz (Group C) students from gold day calculation
  const nonHifzRecords = dayRecords.filter(r => r.student_group !== 'C');
  const presentCount = dayRecords.filter((r) => r.status === "attended").length;
  const absentCount = dayRecords.filter((r) => r.status === "skipped").length;
  const nonHifzPresent = nonHifzRecords.filter(r => r.status === "attended").length;
  const nonHifzTotal = nonHifzRecords.length;
  const isGoldDay = nonHifzTotal > 0 && (nonHifzPresent / nonHifzTotal) * 100 >= 90;
  const teacher = dayRecords[0]?.teacher_name || "Unknown";

  const sortedUnmarkedGroups = Object.keys(unmarkedStudentsByGroup).sort();

  return (
    <AccordionItem 
      value={date}
      className="border rounded-lg px-4 bg-card"
    >
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex flex-col items-start gap-1.5 w-full pr-2 min-w-0">
          {/* Row 1: Day name, badge, delete button */}
          <div className="flex items-center justify-between w-full gap-2">
            <p className="font-semibold text-base sm:text-lg">
              {format(new Date(date), "EEEE,")}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isGoldDay && <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              {totalUnmarked > 0 && (
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs px-2 py-0.5">
                  {totalUnmarked}
                </Badge>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 touch-manipulation text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CalendarX className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl p-6">
                  <AlertDialogHeader className="space-y-4">
                    <AlertDialogTitle className="text-2xl font-bold text-center">Delete All Records for This Day</AlertDialogTitle>
                    <AlertDialogDescription className="text-base text-center leading-relaxed">
                      Are you sure you want to delete all {dayRecords.length} attendance records for {format(new Date(date), "MMMM d, yyyy")}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col gap-3 sm:flex-row mt-6">
                    <AlertDialogCancel className="h-14 text-lg w-full touch-manipulation">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDeleteDay(date)}
                      className="h-14 text-lg w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 touch-manipulation"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {/* Row 2: Date */}
          <p className="font-semibold text-base sm:text-lg">
            {format(new Date(date), "MMM d")}
          </p>
          {/* Row 3: Teacher and stats */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Teacher: {teacher}</span>
            <span className="flex items-center gap-1 text-success">
              <Check className="w-3.5 h-3.5" />
              {presentCount}
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <X className="w-3.5 h-3.5" />
              {absentCount}
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="space-y-2 pt-2">
          {/* Unmarked Students Section - Above marked students */}
          {totalUnmarked > 0 && (
            <Collapsible open={showUnmarked} onOpenChange={setShowUnmarked} className="mb-3 border border-orange-400/30 rounded-lg overflow-hidden">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-orange-500/10 hover:bg-orange-500/20 transition-colors touch-manipulation">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-orange-500" />
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    Unmarked Students
                  </span>
                  <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">
                    {totalUnmarked}
                  </Badge>
                </div>
                <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform ${showUnmarked ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                {sortedUnmarkedGroups.map((group, groupIndex) => {
                  const groupStudents = unmarkedStudentsByGroup[group];
                  const isGroupOpen = expandedUnmarkedGroups[group] ?? false;
                  const isLastGroup = groupIndex === sortedUnmarkedGroups.length - 1;
                  
                  return (
                    <Collapsible 
                      key={group} 
                      open={isGroupOpen} 
                      onOpenChange={() => toggleUnmarkedGroup(group)}
                    >
                      <CollapsibleTrigger className={`flex items-center justify-between w-full p-2 bg-orange-500/5 hover:bg-orange-500/10 transition-colors touch-manipulation ${!isLastGroup || isGroupOpen ? 'border-b border-orange-400/20' : ''}`}>
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`w-3 h-3 text-orange-500 transition-transform ${isGroupOpen ? '' : '-rotate-90'}`} />
                          <span className="font-medium text-sm text-orange-600 dark:text-orange-400">
                            {group === "Unassigned" ? "Unassigned" : `Group ${group} (${getGroupShortLabel(group)})`}
                          </span>
                          <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs">
                            {groupStudents.length}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        {groupStudents.map((student, studentIndex) => {
                          const isLastStudent = studentIndex === groupStudents.length - 1;
                          return (
                            <div 
                              key={student.id}
                              className={`flex items-center justify-between p-2 pl-6 bg-orange-500/5 ${!isLastStudent || !isLastGroup ? 'border-b border-orange-400/10' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {student.student_code}
                                </span>
                                <span className="font-medium text-sm">{student.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0 border-emerald-400/50 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                  onClick={() => handleMarkAttendance(student, "attended")}
                                  disabled={isSubmitting || markingStudent === student.id}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 w-7 p-0 border-destructive/50 hover:bg-destructive/20 text-destructive"
                                  onClick={() => handleMarkAttendance(student, "skipped")}
                                  disabled={isSubmitting || markingStudent === student.id}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {dayRecords.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-3 rounded-md bg-muted/50 gap-3"
            >
              <span className="font-medium flex-1">{record.student_name}</span>
              <div className="flex items-center gap-2">
                {record.status === "attended" ? (
                  <Badge className="bg-success hover:bg-success/90">
                    <Check className="w-3 h-3 mr-1" />
                    Present
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <X className="w-3 h-3 mr-1" />
                    Absent
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 touch-manipulation"
                  onClick={() => onToggleStatus(record)}
                  disabled={isUpdating}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 touch-manipulation text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl p-6">
                    <AlertDialogHeader className="space-y-4">
                      <AlertDialogTitle className="text-2xl font-bold text-center">Delete Attendance Record</AlertDialogTitle>
                      <AlertDialogDescription className="text-base text-center leading-relaxed">
                        Are you sure you want to delete this attendance record for {record.student_name}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-3 sm:flex-row mt-6">
                      <AlertDialogCancel className="h-14 text-lg w-full touch-manipulation">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(record.id)}
                        className="h-14 text-lg w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 touch-manipulation"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default AttendanceTable;