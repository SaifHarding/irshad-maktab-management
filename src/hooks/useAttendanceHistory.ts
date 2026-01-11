import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AttendanceHistoryRecord {
  id: string;
  student_id: string;
  status: string;
  teacher_name: string;
  date: string;
  created_at: string;
  student_name: string;
  student_group: string | null;
}

interface Filters {
  startDate?: string;
  endDate?: string;
  teacher?: string;
  studentId?: string;
  maktab?: string;
}

export const useAttendanceHistory = (filters: Filters) => {
  return useQuery({
    queryKey: ["attendance-history", filters],
    queryFn: async () => {
      let query = supabase
        .from("attendance_records")
        .select(`
          id,
          student_id,
          status,
          teacher_name,
          date,
          created_at,
          students (
            name,
            student_group
          )
        `)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.startDate) {
        query = query.gte("date", filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte("date", filters.endDate);
      }

      if (filters.teacher) {
        query = query.eq("teacher_name", filters.teacher);
      }

      if (filters.studentId) {
        query = query.eq("student_id", filters.studentId);
      }

      if (filters.maktab) {
        query = query.eq("maktab", filters.maktab);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to flatten the student name and group, sort alphabetically
      const transformed = (data || []).map((record: any) => ({
        id: record.id,
        student_id: record.student_id,
        status: record.status,
        teacher_name: record.teacher_name,
        date: record.date,
        created_at: record.created_at,
        student_name: record.students?.name || "Unknown",
        student_group: record.students?.student_group || null,
      })) as AttendanceHistoryRecord[];

      // Sort by date descending, then by student name alphabetically (A-Z)
      return transformed.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return a.student_name.localeCompare(b.student_name);
      });
    },
  });
};
