import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { TeacherAttendanceData } from "@/lib/csvExport";

export type { TeacherAttendanceData } from "@/lib/csvExport";

export interface TeacherAttendanceRecord {
  id: string;
  teacher_name: string;
  maktab: string;
  date: string;
  status: "present" | "absent" | "leave";
  marked_by: string;
  marked_by_name: string;
  auto_marked: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherAttendanceResult {
  teachers: TeacherAttendanceData[];
  boysTeachers: TeacherAttendanceData[];
  girlsTeachers: TeacherAttendanceData[];
  totalDays: number;
  averageDays: number;
  isLoading: boolean;
  explicitRecords: TeacherAttendanceRecord[];
}

export const useTeacherAttendance = (
  selectedMonth: Date,
  maktabFilter: "all" | "boys" | "girls"
): TeacherAttendanceResult => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Fetch teacher profiles to filter out admin-only users
  const { data: teacherProfiles } = useQuery({
    queryKey: ["teacher-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, maktab")
        .not("maktab", "is", null);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch explicit teacher attendance records
  const { data: explicitRecords = [], isLoading: loadingExplicit } = useQuery({
    queryKey: ["teacher-attendance-explicit", format(selectedMonth, "yyyy-MM"), maktabFilter],
    queryFn: async () => {
      let query = supabase
        .from("teacher_attendance")
        .select("*")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));

      if (maktabFilter !== "all") {
        query = query.eq("maktab", maktabFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as TeacherAttendanceRecord[];
    },
  });

  // Fallback: Fetch from audit logs for historical data (before explicit tracking was added)
  const { data: auditData, isLoading: loadingAudit } = useQuery({
    queryKey: ["teacher-attendance-audit", format(selectedMonth, "yyyy-MM"), maktabFilter],
    queryFn: async () => {
      let query = supabase
        .from("attendance_audit_logs")
        .select("performed_by_name, maktab, date")
        .eq("action", "created")
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));

      if (maktabFilter !== "all") {
        query = query.eq("maktab", maktabFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  // Create a set of valid teacher names (those with maktab assigned)
  const validTeachers = new Set(
    teacherProfiles?.map((p) => p.full_name).filter(Boolean) || []
  );

  // Build a map of teacher -> maktab -> dates with status
  const teacherMap = new Map<string, { maktab: string; dates: Set<string>; absentDates: Set<string>; hasExplicit: boolean }>();

  // First, add explicit records (they take precedence)
  explicitRecords?.forEach((record) => {
    const key = `${record.teacher_name}-${record.maktab}`;
    if (!teacherMap.has(key)) {
      teacherMap.set(key, { maktab: record.maktab, dates: new Set(), absentDates: new Set(), hasExplicit: true });
    }
    const entry = teacherMap.get(key)!;
    entry.hasExplicit = true;
    
    if (record.status === "present") {
      entry.dates.add(record.date);
    } else if (record.status === "absent" || record.status === "leave") {
      entry.absentDates.add(record.date);
    }
  });

  // Then, add audit log data for dates not already covered by explicit records
  auditData?.forEach((record) => {
    // Only include if the performer is a valid teacher (has maktab assigned)
    if (!validTeachers.has(record.performed_by_name)) return;

    const key = `${record.performed_by_name}-${record.maktab}`;
    if (!teacherMap.has(key)) {
      teacherMap.set(key, { maktab: record.maktab, dates: new Set(), absentDates: new Set(), hasExplicit: false });
    }
    // Add date if not already present (explicit records take precedence)
    teacherMap.get(key)!.dates.add(record.date);
  });

  const teachers: TeacherAttendanceData[] = Array.from(teacherMap.entries())
    .map(([key, value]) => {
      const teacherName = key.split("-")[0];
      return {
        teacherName,
        maktab: value.maktab,
        dates: Array.from(value.dates).map((d) => new Date(d)),
        absentDates: Array.from(value.absentDates).map((d) => new Date(d)),
        daysCount: value.dates.size,
      };
    })
    .sort((a, b) => b.daysCount - a.daysCount);

  const boysTeachers = teachers.filter((t) => t.maktab === "boys");
  const girlsTeachers = teachers.filter((t) => t.maktab === "girls");

  const totalDays = teachers.reduce((sum, t) => sum + t.daysCount, 0);
  const averageDays = teachers.length > 0 ? totalDays / teachers.length : 0;

  return {
    teachers,
    boysTeachers,
    girlsTeachers,
    totalDays,
    averageDays,
    isLoading: loadingExplicit || loadingAudit,
    explicitRecords,
  };
};
