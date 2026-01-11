import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface MaktabClass {
  id: string;
  code: string;
  name: string;
  label: string;
  parent_group: string | null;
  maktab: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export function useMaktabClasses(maktab?: string) {
  return useQuery({
    queryKey: ["maktab-classes", maktab],
    queryFn: async () => {
      let query = supabase
        .from("maktab_classes")
        .select("*")
        .order("display_order", { ascending: true });

      if (maktab) {
        query = query.eq("maktab", maktab);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching maktab classes:", error);
        throw error;
      }

      return data as MaktabClass[];
    },
  });
}

export function useCreateMaktabClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newClass: Omit<MaktabClass, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("maktab_classes")
        .insert(newClass)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maktab-classes"] });
      toast({
        title: "Class created",
        description: "The new class has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating class",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateMaktabClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<MaktabClass, "name" | "label" | "display_order">>;
    }) => {
      const { data, error } = await supabase
        .from("maktab_classes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maktab-classes"] });
      toast({
        title: "Class updated",
        description: "The class has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating class",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteMaktabClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maktab_classes").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maktab-classes"] });
      toast({
        title: "Class deleted",
        description: "The class has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting class",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useClassStudentCount(classCode: string, maktab: string) {
  return useQuery({
    queryKey: ["class-student-count", classCode, maktab],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("student_group", classCode)
        .eq("maktab", maktab)
        .eq("status", "active");

      if (error) throw error;
      return count ?? 0;
    },
  });
}
