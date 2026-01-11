import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useDeleteAttendance = () => {
  const queryClient = useQueryClient();

  const deleteAttendance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attendance_records")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      toast({
        title: "Record deleted",
        description: "Attendance record has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete record. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting attendance:", error);
    },
  });

  return {
    deleteAttendance: deleteAttendance.mutate,
    isDeleting: deleteAttendance.isPending,
  };
};
