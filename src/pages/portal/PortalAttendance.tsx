import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { portalSupabase as supabase } from "@/integrations/supabase/portalClient";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { useLinkedStudents, useStudentAttendance } from "@/hooks/useParentData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, XCircle, Clock, Star, List, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { format, subDays, isWithinInterval, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSameMonth, startOfYear, endOfYear } from "date-fns";
import { cn } from "@/lib/utils";

export default function PortalAttendance() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"7days" | "30days" | "thisMonth" | "all">("30days");
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "year">("calendar");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: students, isLoading: studentsLoading } = useLinkedStudents();
  const { data: attendance, isLoading: attendanceLoading } = useStudentAttendance(selectedStudentId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/portal/auth", { replace: true });
      } else {
        setIsAuthenticated(true);
      }
    });
  }, [navigate]);

  // Set student from URL param or default to first student
  useEffect(() => {
    if (students && students.length > 0 && !selectedStudentId) {
      const urlStudentId = searchParams.get("student");
      const validStudent = urlStudentId && students.some(s => s.id === urlStudentId);
      setSelectedStudentId(validStudent ? urlStudentId : students[0].id);
    }
  }, [students, selectedStudentId, searchParams]);

  // Generate calendar days for the selected month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start on Monday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [calendarMonth]);

  // Generate mini calendar days for a specific month (for year view)
  const getMiniCalendarDays = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  // Get all months for the selected year
  const yearMonths = useMemo(() => {
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
    return eachMonthOfInterval({ start: yearStart, end: yearEnd });
  }, [selectedYear]);

  // Get attendance for a specific day
  const getAttendanceForDay = (day: Date) => {
    return attendance?.find(record => isSameDay(new Date(record.date), day));
  };

  // Filter attendance for calendar month stats
  const calendarMonthAttendance = useMemo(() => {
    if (!attendance) return [];
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    return attendance.filter(record => {
      const recordDate = new Date(record.date);
      return isWithinInterval(recordDate, { start: monthStart, end: monthEnd });
    });
  }, [attendance, calendarMonth]);

  // Filter attendance for selected year stats
  const yearAttendance = useMemo(() => {
    if (!attendance) return [];
    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
    return attendance.filter(record => {
      const recordDate = new Date(record.date);
      return isWithinInterval(recordDate, { start: yearStart, end: yearEnd });
    });
  }, [attendance, selectedYear]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const selectedStudent = students?.find(s => s.id === selectedStudentId);

  // Filter attendance by date (for list view)
  const filteredAttendance = attendance?.filter(record => {
    const recordDate = new Date(record.date);
    const now = new Date();

    switch (dateFilter) {
      case "7days":
        return recordDate >= subDays(now, 7);
      case "30days":
        return recordDate >= subDays(now, 30);
      case "thisMonth":
        return isWithinInterval(recordDate, {
          start: startOfMonth(now),
          end: endOfMonth(now)
        });
      case "all":
      default:
        return true;
    }
  }) || [];

  // Calculate stats based on view mode
  const statsAttendance = viewMode === "calendar" ? calendarMonthAttendance : viewMode === "year" ? yearAttendance : filteredAttendance;
  const presentCount = statsAttendance.filter(a => a.status === "present" || a.status === "attended").length;
  const absentCount = statsAttendance.filter(a => a.status === "absent" || a.status === "skipped").length;
  const excusedCount = statsAttendance.filter(a => a.status === "excused").length;
  const attendanceRate = statsAttendance.length > 0 
    ? Math.round((presentCount / statsAttendance.length) * 100) 
    : 0;

  // Calculate perfect months (100% attendance in a month)
  const perfectMonthsCount = (() => {
    if (!attendance || attendance.length === 0) return 0;
    
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);
    const months = eachMonthOfInterval({ start: sixMonthsAgo, end: now });
    
    let perfectCount = 0;
    months.forEach(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const monthRecords = attendance.filter(a => {
        const recordDate = new Date(a.date);
        return isWithinInterval(recordDate, { start: monthStart, end: monthEnd });
      });
      
      if (monthRecords.length > 0) {
        const allPresent = monthRecords.every(a => a.status === "present" || a.status === "attended");
        if (allPresent) perfectCount++;
      }
    });
    
    return perfectCount;
  })();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
      case "attended":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "absent":
      case "skipped":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "excused":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
      case "attended":
        return <Badge className="bg-success/10 text-success border-success/20">Present</Badge>;
      case "absent":
      case "skipped":
        return <Badge variant="destructive">Absent</Badge>;
      case "excused":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Excused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
      case "attended":
        return "bg-success text-success-foreground";
      case "absent":
      case "skipped":
        return "bg-destructive text-destructive-foreground";
      case "excused":
        return "bg-warning text-warning-foreground";
      default:
        return "bg-muted";
    }
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDaysShort = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <PortalLayout title="Attendance">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Attendance History</h2>
          <p className="text-muted-foreground mt-1">
            View your child's attendance records.
          </p>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4">
            {students && students.length > 1 && (
              <Select value={selectedStudentId || ""} onValueChange={setSelectedStudentId}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {viewMode === "list" && (
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as typeof dateFilter)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="thisMonth">This month</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-2"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Month</span>
            </Button>
            <Button
              variant={viewMode === "year" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("year")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Year</span>
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{attendanceRate}%</p>
                <p className="text-xs text-muted-foreground">Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{presentCount}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{absentCount}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-warning">{excusedCount}</p>
                <p className="text-xs text-muted-foreground">Excused</p>
              </div>
            </CardContent>
          </Card>
          <Card className={perfectMonthsCount > 0 ? 'bg-gradient-to-br from-yellow-500/10 to-yellow-400/5 border-yellow-500/20' : ''}>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {perfectMonthsCount > 0 && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />}
                  <p className={`text-2xl font-bold ${perfectMonthsCount > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`}>{perfectMonthsCount}</p>
                </div>
                <p className="text-xs text-muted-foreground">Perfect Months</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  {format(calendarMonth, "MMMM yyyy")}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCalendarMonth(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {studentsLoading || attendanceLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <>
                  {/* Week day headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map(day => (
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                      const record = getAttendanceForDay(day);
                      const isCurrentMonth = isSameMonth(day, calendarMonth);
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors relative",
                            !isCurrentMonth && "opacity-30",
                            isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                            record ? getStatusColor(record.status) : "bg-muted/50"
                          )}
                        >
                          <span className={cn(
                            "font-medium",
                            record && "text-inherit"
                          )}>
                            {format(day, "d")}
                          </span>
                          {record && (
                            <span className="text-[10px] opacity-80 hidden sm:block">
                              {record.status === "present" || record.status === "attended" ? "✓" : 
                               record.status === "absent" || record.status === "skipped" ? "✗" : "!"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t justify-center">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-success"></div>
                      <span className="text-muted-foreground">Present</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-destructive"></div>
                      <span className="text-muted-foreground">Absent</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-warning"></div>
                      <span className="text-muted-foreground">Excused</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-muted"></div>
                      <span className="text-muted-foreground">No Record</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Year View */}
        {viewMode === "year" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5" />
                  {selectedYear}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedYear(selectedYear - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedYear(new Date().getFullYear())}
                  >
                    This Year
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedYear(selectedYear + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {studentsLoading || attendanceLoading ? (
                <Skeleton className="h-[600px] w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {yearMonths.map((month, monthIdx) => {
                      const miniDays = getMiniCalendarDays(month);
                      const monthRecords = attendance?.filter(a => {
                        const recordDate = new Date(a.date);
                        return isSameMonth(recordDate, month);
                      }) || [];
                      const monthPresent = monthRecords.filter(a => a.status === "present" || a.status === "attended").length;
                      const monthTotal = monthRecords.length;
                      const monthRate = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : null;
                      
                      return (
                        <div 
                          key={monthIdx} 
                          className="border rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setCalendarMonth(month);
                            setViewMode("calendar");
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm">{format(month, "MMM")}</h4>
                            {monthRate !== null && (
                              <Badge variant="secondary" className={cn(
                                "text-xs",
                                monthRate === 100 && "bg-success/20 text-success",
                                monthRate >= 80 && monthRate < 100 && "bg-primary/20 text-primary",
                                monthRate < 80 && "bg-destructive/20 text-destructive"
                              )}>
                                {monthRate}%
                              </Badge>
                            )}
                          </div>
                          
                          {/* Mini week headers */}
                          <div className="grid grid-cols-7 gap-px mb-1">
                            {weekDaysShort.map((day, i) => (
                              <div key={i} className="text-center text-[8px] text-muted-foreground">
                                {day}
                              </div>
                            ))}
                          </div>
                          
                          {/* Mini calendar grid */}
                          <div className="grid grid-cols-7 gap-px">
                            {miniDays.map((day, dayIdx) => {
                              const record = getAttendanceForDay(day);
                              const isCurrentMonth = isSameMonth(day, month);
                              const isToday = isSameDay(day, new Date());
                              
                              return (
                                <div
                                  key={dayIdx}
                                  className={cn(
                                    "aspect-square flex items-center justify-center text-[9px] rounded-sm",
                                    !isCurrentMonth && "opacity-20",
                                    isToday && "ring-1 ring-primary",
                                    record ? getStatusColor(record.status) : "bg-muted/30"
                                  )}
                                >
                                  {format(day, "d")}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t justify-center">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-success"></div>
                      <span className="text-muted-foreground">Present</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-destructive"></div>
                      <span className="text-muted-foreground">Absent</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-warning"></div>
                      <span className="text-muted-foreground">Excused</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 rounded bg-muted"></div>
                      <span className="text-muted-foreground">No Record</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Click on a month to view details
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {selectedStudent?.name ? `${selectedStudent.name}'s Records` : "Attendance Records"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {studentsLoading || attendanceLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredAttendance.length > 0 ? (
                <div className="space-y-2">
                  {filteredAttendance.map(record => (
                    <div 
                      key={record.id} 
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(record.status)}
                        <div>
                          <p className="font-medium text-foreground">
                            {format(new Date(record.date), "EEEE, d MMMM yyyy")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Teacher: {record.teacher_name}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(record.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No attendance records found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
