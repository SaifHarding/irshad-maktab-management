import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AttendanceRecord {
  student_id: string;
  status: "attended" | "skipped";
  teacher_name: string;
  date: string;
  maktab: string;
}

interface SubmitParams {
  records: AttendanceRecord[];
  forceUpdate?: boolean;
}

export const useAttendance = (maktab?: "boys" | "girls") => {
  const submitAttendance = useMutation({
    mutationFn: async ({ records, forceUpdate }: SubmitParams) => {
      if (forceUpdate) {
        // Update existing records instead of inserting
        for (const record of records) {
          // First check if record exists
          const { data: existing } = await supabase
            .from("attendance_records")
            .select("id")
            .eq("student_id", record.student_id)
            .eq("date", record.date)
            .eq("maktab", record.maktab)
            .single();
          
          if (existing) {
            // Update existing record
            const { error } = await supabase
              .from("attendance_records")
              .update({ status: record.status, teacher_name: record.teacher_name })
              .eq("id", existing.id);
            
            if (error) throw error;
          } else {
            // Insert new record if it doesn't exist
            const { error } = await supabase
              .from("attendance_records")
              .insert(record);
            
            if (error) throw error;
          }
        }
      } else {
        // Normal insert for new records
        const { error } = await supabase
          .from("attendance_records")
          .insert(records);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Attendance saved",
        description: "All attendance records have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save attendance. Please try again.",
        variant: "destructive",
      });
      console.error("Error saving attendance:", error);
    },
  });

  return {
    submitAttendance: submitAttendance.mutate,
    isSubmitting: submitAttendance.isPending,
  };
};
