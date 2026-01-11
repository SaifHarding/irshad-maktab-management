import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StarStudentSnapshot {
  id: string;
  student_id: string;
  maktab: string;
  snapshot_month: string;
  created_at: string;
}

// Get star count for each student
export const useStarStudentCounts = (maktab: string) => {
  return useQuery({
    queryKey: ["star-student-counts", maktab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("star_student_snapshots")
        .select("student_id, snapshot_month")
        .eq("maktab", maktab);

      if (error) throw error;

      // Count stars per student
      const counts: Record<string, number> = {};
      (data || []).forEach((snapshot: StarStudentSnapshot) => {
        counts[snapshot.student_id] = (counts[snapshot.student_id] || 0) + 1;
      });

      return counts;
    },
  });
};

// Save star students for a month
export const useSaveStarStudents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      studentIds,
      maktab,
      month,
    }: {
      studentIds: string[];
      maktab: string;
      month: string;
    }) => {
      if (studentIds.length === 0) return { saved: 0 };

      // Use upsert to avoid duplicates
      const records = studentIds.map((studentId) => ({
        student_id: studentId,
        maktab,
        snapshot_month: month,
      }));

      const { error } = await supabase
        .from("star_student_snapshots")
        .upsert(records, { 
          onConflict: "student_id,maktab,snapshot_month",
          ignoreDuplicates: true 
        });

      if (error) throw error;

      return { saved: studentIds.length };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["star-student-counts", variables.maktab] });
    },
  });
};
