import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useDeleteStudent = () => {
  const queryClient = useQueryClient();

  const deleteStudent = useMutation({
    mutationFn: async ({ id }: { id: string; studentCode?: string | null; maktab?: string }) => {
      // Soft delete: set status to 'left' instead of permanently deleting
      const { error } = await supabase
        .from("students")
        .update({ status: "left" })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({
        title: "Student marked as left",
        description: "Student has been marked as left and will no longer appear in registers.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove student. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting student:", error);
    },
  });

  return {
    deleteStudent: deleteStudent.mutate,
    isDeleting: deleteStudent.isPending,
  };
};
