import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GroupCode } from "@/lib/groups";

interface TeacherGroup {
  id: string;
  teacher_name: string;
  group_code: GroupCode;
  maktab: string;
}

export const useTeacherGroup = (teacherName: string | undefined, maktab: "boys" | "girls") => {
  const { data: teacherGroup, isLoading } = useQuery({
    queryKey: ["teacher_group", teacherName, maktab],
    queryFn: async () => {
      if (!teacherName || maktab !== "boys") return null;
      
      const { data, error } = await supabase
        .from("teacher_groups")
        .select("*")
        .eq("teacher_name", teacherName)
        .eq("maktab", maktab)
        .maybeSingle();
      
      if (error) throw error;
      return data as TeacherGroup | null;
    },
    enabled: !!teacherName && maktab === "boys",
  });

  return {
    teacherGroup,
    groupCode: teacherGroup?.group_code as GroupCode | undefined,
    isLoading,
  };
};

export const useTeacherGroups = (teacherName: string | undefined, maktab: "boys" | "girls") => {
  const { data: teacherGroups = [], isLoading } = useQuery({
    queryKey: ["teacher_groups_by_teacher", teacherName, maktab],
    queryFn: async () => {
      if (!teacherName) return [];
      
      const { data, error } = await supabase
        .from("teacher_groups")
        .select("*")
        .eq("teacher_name", teacherName)
        .eq("maktab", maktab);
      
      if (error) throw error;
      return data as TeacherGroup[];
    },
    enabled: !!teacherName,
  });

  return {
    teacherGroups,
    groupCodes: teacherGroups.map(g => g.group_code as GroupCode),
    isLoading,
  };
};

export const useAllTeacherGroups = (maktab: "boys" | "girls") => {
  const { data: teacherGroups = [], isLoading, refetch } = useQuery({
    queryKey: ["teacher_groups", maktab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_groups")
        .select("*")
        .eq("maktab", maktab);
      
      if (error) throw error;
      return data as TeacherGroup[];
    },
  });

  return {
    teacherGroups,
    isLoading,
    refetch,
  };
};
