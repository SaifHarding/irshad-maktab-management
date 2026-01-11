import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useDeleteDayAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from("attendance_records")
        .delete()
        .eq("date", date);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      toast({
        title: "Day records deleted",
        description: "All attendance records for this day have been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete day records. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting day records:", error);
    },
  });
};
