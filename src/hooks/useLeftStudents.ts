import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface LeftStudent {
  id: string;
  name: string;
  student_code: string | null;
  student_group: string | null;
  maktab: string;
}

export const useLeftStudents = (maktab?: "boys" | "girls") => {
  const queryClient = useQueryClient();

  const { data: leftStudents = [], isLoading } = useQuery({
    queryKey: ["left-students", maktab],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("id, name, student_code, student_group, maktab")
        .eq("status", "left")
        .order("name");
      
      if (maktab) {
        query = query.eq("maktab", maktab);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as LeftStudent[];
    },
  });

  const restoreStudent = useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from("students")
        .update({ status: "active" })
        .eq("id", studentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["left-students", maktab] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({
        title: "Student restored",
        description: "Student has been restored and will now appear in registers.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to restore student. Please try again.",
        variant: "destructive",
      });
      console.error("Error restoring student:", error);
    },
  });

  return {
    leftStudents,
    isLoading,
    restoreStudent: restoreStudent.mutate,
    isRestoring: restoreStudent.isPending,
  };
};
