import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export type TeacherAttendanceStatus = "present" | "absent" | "leave";

export interface TeacherAttendanceRecord {
  id: string;
  teacher_name: string;
  maktab: string;
  date: string;
  status: TeacherAttendanceStatus;
  marked_by: string;
  marked_by_name: string;
  auto_marked: boolean;
  created_at: string;
  updated_at: string;
}

export const useTeacherAttendanceRecord = (maktab: "boys" | "girls", date: Date = new Date()) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dateStr = format(date, "yyyy-MM-dd");

  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ["teacher_attendance_records", maktab, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_attendance")
        .select("*")
        .eq("maktab", maktab)
        .eq("date", dateStr);

      if (error) throw error;
      return data as TeacherAttendanceRecord[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      teacherName,
      status,
      markedBy,
      markedByName,
    }: {
      teacherName: string;
      status: TeacherAttendanceStatus;
      markedBy: string;
      markedByName: string;
    }) => {
      const { data, error } = await supabase
        .from("teacher_attendance")
        .upsert(
          {
            teacher_name: teacherName,
            maktab,
            date: dateStr,
            status,
            marked_by: markedBy,
            marked_by_name: markedByName,
            auto_marked: false, // Manual entries are never auto-marked
          },
          {
            onConflict: "teacher_name,maktab,date",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher_attendance_records", maktab, dateStr] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update teacher attendance",
        variant: "destructive",
      });
      console.error("Error updating teacher attendance:", error);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async ({
      teachers,
      status,
      markedBy,
      markedByName,
    }: {
      teachers: string[];
      status: TeacherAttendanceStatus;
      markedBy: string;
      markedByName: string;
    }) => {
      const records = teachers.map((teacherName) => ({
        teacher_name: teacherName,
        maktab,
        date: dateStr,
        status,
        marked_by: markedBy,
        marked_by_name: markedByName,
        auto_marked: false,
      }));

      const { data, error } = await supabase
        .from("teacher_attendance")
        .upsert(records, {
          onConflict: "teacher_name,maktab,date",
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher_attendance_records", maktab, dateStr] });
      toast({
        title: "Success",
        description: "All teachers marked successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark all teachers",
        variant: "destructive",
      });
      console.error("Error marking all teachers:", error);
    },
  });

  const getTeacherStatus = (teacherName: string): TeacherAttendanceRecord | undefined => {
    return records.find((r) => r.teacher_name === teacherName);
  };

  return {
    records,
    isLoading,
    refetch,
    upsertAttendance: upsertMutation.mutate,
    markAllTeachers: markAllMutation.mutate,
    getTeacherStatus,
    isUpdating: upsertMutation.isPending || markAllMutation.isPending,
  };
};
