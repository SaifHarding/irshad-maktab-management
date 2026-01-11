import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStudentAuditLogs, useAttendanceDayLogs, useProgressAuditLogs, useParentActivityLogs } from "@/hooks/useAuditLogs";
import { formatDistanceToNow, format } from "date-fns";
import { ArrowLeft, Home, UserPlus, UserMinus, Calendar, TrendingUp, Search, Users, UserCheck, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { paths } from "@/lib/portalPaths";

export default function AuditLogs() {
  const navigate = useNavigate();
  const { maktab } = useParams<{ maktab: "boys" | "girls" }>();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [datePreset, setDatePreset] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { auditLogs: studentLogs, isLoading: studentLoading } = useStudentAuditLogs(
    maktab,
    dateRange?.from,
    dateRange?.to
  );
  const { auditLogs: attendanceLogs, isLoading: attendanceLoading } = useAttendanceDayLogs(
    maktab,
    dateRange?.from,
    dateRange?.to
  );
  const { auditLogs: progressLogs, isLoading: progressLoading } = useProgressAuditLogs(
    maktab,
    dateRange?.from,
    dateRange?.to
  );
  const { auditLogs: parentActivityLogs, isLoading: parentActivityLoading } = useParentActivityLogs(
    maktab,
    dateRange?.from,
    dateRange?.to
  );

  // Filter logs based on search query
  const filteredStudentLogs = useMemo(() => {
    if (!searchQuery.trim()) return studentLogs;
    
    const query = searchQuery.toLowerCase();
    return studentLogs.filter(log => 
      log.student_name.toLowerCase().includes(query) ||
      log.performed_by_name.toLowerCase().includes(query)
    );
  }, [studentLogs, searchQuery]);

  // Group attendance logs by date + teacher + maktab
  const groupedAttendanceLogs = useMemo(() => {
    const grouped = new Map<string, {
      id: string;
      date: string;
      maktab: string;
      teacher_name: string;
      groups: { group: string; count: number }[];
      total_count: number;
      performed_by_name: string;
      created_at: string;
    }>();

    attendanceLogs.forEach(log => {
      const key = `${log.date}-${log.teacher_name}-${log.maktab}`;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.groups.push({ group: log.student_group, count: log.student_count });
        existing.total_count += log.student_count;
        // Keep the most recent created_at
        if (new Date(log.created_at) > new Date(existing.created_at)) {
          existing.created_at = log.created_at;
          existing.performed_by_name = log.performed_by_name;
        }
      } else {
        grouped.set(key, {
          id: log.id,
          date: log.date,
          maktab: log.maktab,
          teacher_name: log.teacher_name,
          groups: [{ group: log.student_group, count: log.student_count }],
          total_count: log.student_count,
          performed_by_name: log.performed_by_name,
          created_at: log.created_at,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [attendanceLogs]);

  const filteredAttendanceLogs = useMemo(() => {
    if (!searchQuery.trim()) return groupedAttendanceLogs;
    
    const query = searchQuery.toLowerCase();
    return groupedAttendanceLogs.filter(log => 
      log.teacher_name.toLowerCase().includes(query) ||
      log.groups.some(g => g.group.toLowerCase().includes(query)) ||
      log.performed_by_name.toLowerCase().includes(query)
    );
  }, [groupedAttendanceLogs, searchQuery]);

  const filteredProgressLogs = useMemo(() => {
    if (!searchQuery.trim()) return progressLogs;
    
    const query = searchQuery.toLowerCase();
    return progressLogs.filter(log => 
      log.student_name.toLowerCase().includes(query) ||
      log.field_changed.toLowerCase().includes(query) ||
      log.performed_by_name.toLowerCase().includes(query)
    );
  }, [progressLogs, searchQuery]);

  const filteredParentActivityLogs = useMemo(() => {
    if (!searchQuery.trim()) return parentActivityLogs;
    
    const query = searchQuery.toLowerCase();
    return parentActivityLogs.filter(log => 
      log.parent_email.toLowerCase().includes(query)
    );
  }, [parentActivityLogs, searchQuery]);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate(paths.auth());
      return;
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin");
    
    if (!isAdmin) {
      navigate(paths.home());
      return;
    }

    setCheckingAccess(false);
  };

  if (checkingAccess || studentLoading || attendanceLoading || progressLoading || parentActivityLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const maktabTitle = maktab 
    ? `${maktab.charAt(0).toUpperCase() + maktab.slice(1)} Maktab` 
    : "All";

  const getGroupLabel = (group: string) => {
    switch (group) {
      case "A": return "Group A (Qaidah)";
      case "B": return "Group B (Quran)";
      case "C": return "Group C (Hifz)";
      default: return group;
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 pb-20">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to={paths.admin()}>
              <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold">{maktabTitle} Audit Logs</h1>
          </div>
          <Link to={paths.home()}>
            <Button variant="outline" size="sm" className="h-8 sm:h-9 px-2 sm:px-3">
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
            <CardDescription>
              Track attendance submissions, progress changes, and student changes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {/* Filters */}
            <div className="space-y-3 mb-4">
              <DateRangePicker 
                date={dateRange} 
                onDateChange={setDateRange}
                selectedPreset={datePreset}
                onPresetChange={setDatePreset}
              />
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="attendance" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="attendance" className="text-xs sm:text-sm py-2.5">
                  Attendance ({filteredAttendanceLogs.length})
                </TabsTrigger>
                <TabsTrigger value="progress" className="text-xs sm:text-sm py-2.5">
                  Progress ({filteredProgressLogs.length})
                </TabsTrigger>
                <TabsTrigger value="students" className="text-xs sm:text-sm py-2.5">
                  Students ({filteredStudentLogs.length})
                </TabsTrigger>
                <TabsTrigger value="parents" className="text-xs sm:text-sm py-2.5">
                  Parents ({filteredParentActivityLogs.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="attendance" className="mt-4">
                {filteredAttendanceLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    {searchQuery.trim() 
                      ? "No logs found matching your search" 
                      : "No attendance logs for the selected period"}
                  </p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {filteredAttendanceLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 sm:gap-3 p-3 border rounded-lg"
                      >
                        <div className="mt-0.5 shrink-0">
                          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {log.groups.map((g, idx) => (
                              <Badge 
                                key={idx} 
                                variant="default" 
                                className={`text-xs ${log.maktab === 'girls' ? 'bg-pink-200 text-pink-800 hover:bg-pink-300' : ''}`}
                              >
                                {getGroupLabel(g.group)} ({g.count})
                              </Badge>
                            ))}
                          </div>
                          <span className="font-medium text-sm">
                            {format(new Date(log.date), "MMM d, yyyy")}
                          </span>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{log.total_count} students total</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Teacher: {log.teacher_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Logged by {log.performed_by_name} • {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="progress" className="mt-4">
                {filteredProgressLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    {searchQuery.trim() 
                      ? "No logs found matching your search" 
                      : "No progress logs for the selected period"}
                  </p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {filteredProgressLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 sm:gap-3 p-3 border rounded-lg"
                      >
                        <div className="mt-0.5 shrink-0">
                          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {log.field_changed}
                            </Badge>
                            <span className="font-medium text-sm">{log.student_name}</span>
                            {log.student_group && (
                              <Badge variant="outline" className="text-xs">
                                Group {log.student_group}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm">
                            <span className="text-muted-foreground">
                              {log.old_value ? (
                                <>
                                  <strong>{log.old_value === "true" ? "Yes" : log.old_value === "false" ? "No" : log.old_value || "None"}</strong>
                                  {" → "}
                                  <strong>{log.new_value === "true" ? "Yes" : log.new_value === "false" ? "No" : log.new_value || "None"}</strong>
                                </>
                              ) : (
                                <>Set to <strong>{log.new_value === "true" ? "Yes" : log.new_value === "false" ? "No" : log.new_value || "None"}</strong></>
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            By {log.performed_by_name} • {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="students" className="mt-4">
                {filteredStudentLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    {searchQuery.trim() 
                      ? "No logs found matching your search" 
                      : "No student logs for the selected period"}
                  </p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {filteredStudentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 sm:gap-3 p-3 border rounded-lg"
                      >
                        <div className="mt-0.5 shrink-0">
                          {log.action === "added" ? (
                            <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                          ) : (
                            <UserMinus className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={log.action === "added" ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {log.action}
                            </Badge>
                            <span className="font-medium text-sm">{log.student_name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            By {log.performed_by_name} • {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="parents" className="mt-4">
                {filteredParentActivityLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    {searchQuery.trim() 
                      ? "No logs found matching your search" 
                      : "No parent activity logs for the selected period"}
                  </p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {filteredParentActivityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 sm:gap-3 p-3 border rounded-lg"
                      >
                        <div className="mt-0.5 shrink-0">
                          {log.activity_type === "registered" ? (
                            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                          ) : (
                            <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={log.activity_type === "registered" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {log.activity_type === "registered" ? "Registered" : "Dashboard View"}
                            </Badge>
                            <span className="font-medium text-sm">{log.parent_email}</span>
                          </div>
                          {log.maktab && (
                            <p className="text-xs text-muted-foreground">
                              Maktab: {log.maktab === "both" ? "Boys & Girls" : log.maktab.charAt(0).toUpperCase() + log.maktab.slice(1)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
