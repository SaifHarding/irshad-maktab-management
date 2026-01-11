import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentAuditLog {
  id: string;
  action: "added" | "removed";
  student_id: string;
  student_name: string;
  maktab: string;
  performed_by: string;
  performed_by_name: string;
  created_at: string;
}

export interface AttendanceDayLog {
  id: string;
  date: string;
  maktab: string;
  student_group: string;
  teacher_name: string;
  student_count: number;
  performed_by: string;
  performed_by_name: string;
  created_at: string;
}

export interface ProgressAuditLog {
  id: string;
  student_id: string;
  student_name: string;
  student_group: string | null;
  maktab: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  performed_by: string;
  performed_by_name: string;
  created_at: string;
}

export interface ParentActivityLog {
  id: string;
  parent_id: string;
  parent_email: string;
  activity_type: "registered" | "dashboard_view";
  maktab: string | null;
  created_at: string;
}

export const useStudentAuditLogs = (
  maktab?: "boys" | "girls",
  startDate?: Date,
  endDate?: Date
) => {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["student-audit-logs", maktab, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("student_audit_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (maktab) {
        query = query.eq("maktab", maktab);
      }
      
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as StudentAuditLog[];
    },
  });

  return {
    auditLogs,
    isLoading,
  };
};

export const useAttendanceDayLogs = (
  maktab?: "boys" | "girls",
  startDate?: Date,
  endDate?: Date
) => {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["attendance-day-logs", maktab, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("attendance_day_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (maktab) {
        query = query.eq("maktab", maktab);
      }
      
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as AttendanceDayLog[];
    },
  });

  return {
    auditLogs,
    isLoading,
  };
};

export const useProgressAuditLogs = (
  maktab?: "boys" | "girls",
  startDate?: Date,
  endDate?: Date
) => {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["progress-audit-logs", maktab, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("progress_audit_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (maktab) {
        query = query.eq("maktab", maktab);
      }
      
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ProgressAuditLog[];
    },
  });

  return {
    auditLogs,
    isLoading,
  };
};

export const useParentActivityLogs = (
  maktab?: "boys" | "girls",
  startDate?: Date,
  endDate?: Date
) => {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["parent-activity-logs", maktab, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("parent_activity_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (maktab) {
        query = query.or(`maktab.eq.${maktab},maktab.eq.both`);
      }
      
      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ParentActivityLog[];
    },
  });

  return {
    auditLogs,
    isLoading,
  };
};
