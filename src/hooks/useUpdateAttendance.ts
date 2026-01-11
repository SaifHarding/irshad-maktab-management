import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UpdateAttendanceParams {
  id: string;
  status: "attended" | "skipped";
}

export const useUpdateAttendance = () => {
  const queryClient = useQueryClient();

  const updateAttendance = useMutation({
    mutationFn: async ({ id, status }: UpdateAttendanceParams) => {
      const { error } = await supabase
        .from("attendance_records")
        .update({ status })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      toast({
        title: "Attendance updated",
        description: "Record updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update attendance. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating attendance:", error);
    },
  });

  return {
    updateAttendance: updateAttendance.mutate,
    isUpdating: updateAttendance.isPending,
  };
};
