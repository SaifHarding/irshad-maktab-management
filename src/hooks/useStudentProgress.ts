import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getParentGroup } from "@/lib/groups";

interface ProgressUpdateData {
  studentId: string;
  updates: {
    qaidah_level?: number;
    duas_status?: string;
    quran_juz?: number | null;
    quran_completed?: boolean;
    tajweed_level?: number | null;
    tajweed_completed?: boolean;
    hifz_sabak?: number;
    hifz_s_para?: number;
    hifz_daur?: number | null;
    hifz_graduated?: boolean;
    juz_amma_surah?: number | null;
    juz_amma_completed?: boolean;
    last_progress_month?: string;
  };
  createSnapshot?: boolean; // Whether to create a monthly snapshot
}

interface GraduationData {
  studentId: string;
  fromGroup: string; // Can be A, A1, A2, B, etc.
  toGroup: "B" | "C";
  assignedTeacher?: string; // Required when graduating to C (boys only)
}

export const useStudentProgress = (maktab?: "boys" | "girls", groupCode?: string) => {
  const queryClient = useQueryClient();

  const updateProgress = useMutation({
    mutationFn: async ({ studentId, updates, createSnapshot = false }: ProgressUpdateData) => {
      // Update the student record
      const { data, error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", studentId)
        .select()
        .single();

      if (error) throw error;

      // Create a monthly snapshot if requested
      if (createSnapshot && updates.last_progress_month) {
        const snapshotData = {
          student_id: studentId,
          snapshot_month: updates.last_progress_month,
          maktab: data.maktab,
          student_group: data.student_group,
          qaidah_level: data.qaidah_level,
          duas_status: data.duas_status,
          quran_juz: data.quran_juz,
          quran_completed: data.quran_completed,
          tajweed_level: data.tajweed_level,
          tajweed_completed: data.tajweed_completed,
          hifz_sabak: data.hifz_sabak,
          hifz_s_para: data.hifz_s_para,
          hifz_daur: data.hifz_daur,
          hifz_graduated: data.hifz_graduated,
          juz_amma_surah: data.juz_amma_surah,
          juz_amma_completed: data.juz_amma_completed,
        };

        // Upsert snapshot (update if exists for this month, otherwise insert)
        const { error: snapshotError } = await supabase
          .from("student_progress_snapshots")
          .upsert(snapshotData, { onConflict: "student_id,snapshot_month" });

        if (snapshotError) {
          console.error("Error creating progress snapshot:", snapshotError);
        } else {
          // Send progress update notification to linked parents
          try {
            await supabase.functions.invoke("send-progress-update", {
              body: {
                studentId,
                studentName: data.name,
                snapshotMonth: updates.last_progress_month,
              },
            });
          } catch (emailErr) {
            console.error("Error sending progress update notification:", emailErr);
            // Don't throw - snapshot was saved successfully
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all student queries for this maktab to ensure cache is refreshed
      queryClient.invalidateQueries({ queryKey: ["students", maktab] });
      toast({
        title: "Progress saved",
        description: "Student progress has been updated.",
      });
    },
    onError: (error) => {
      console.error("Error updating progress:", error);
      toast({
        title: "Error",
        description: "Failed to save progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  const graduateStudent = useMutation({
    mutationFn: async ({ studentId, fromGroup, toGroup, assignedTeacher }: GraduationData) => {
      const updates: Record<string, unknown> = {
        student_group: toGroup,
      };

      // Get parent group to determine which fields to clear (A1, A2 -> A)
      const parentFromGroup = getParentGroup(fromGroup);

      // Clear old progress fields based on source group
      if (parentFromGroup === "A") {
        updates.qaidah_level = null;
        updates.duas_status = null;
      } else if (parentFromGroup === "B") {
        updates.quran_juz = null;
        updates.quran_completed = false;
        updates.tajweed_level = null;
        updates.tajweed_completed = false;
      }

      // Assign teacher for boys graduating to Hifz
      if (toGroup === "C" && assignedTeacher) {
        updates.assigned_teacher = assignedTeacher;
      }

      const { data, error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", studentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({
        title: "Student graduated!",
        description: `Student has been moved to Group ${variables.toGroup}.`,
      });
    },
    onError: (error) => {
      console.error("Error graduating student:", error);
      toast({
        title: "Error",
        description: "Failed to graduate student. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    updateProgress: updateProgress.mutate,
    graduateStudent: graduateStudent.mutate,
    isUpdating: updateProgress.isPending,
    isGraduating: graduateStudent.isPending,
  };
};
