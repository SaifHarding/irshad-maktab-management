import { useQuery } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { supabase as adminSupabase } from "@/integrations/supabase/client";
import { useParentGhostMode } from "@/contexts/ParentGhostModeContext";

export interface LinkedStudent {
  id: string;
  name: string;
  student_code: string | null;
  student_group: string | null;
  maktab: string;
  status: string;
  qaidah_level: number | null;
  quran_juz: number | null;
  quran_completed: boolean | null;
  tajweed_level: number | null;
  tajweed_completed: boolean | null;
  hifz_sabak: number | null;
  hifz_s_para: number | null;
  hifz_daur: number | null;
  hifz_graduated: boolean | null;
  juz_amma_surah: number | null;
  juz_amma_completed: boolean | null;
  duas_status: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  home_contact: string | null;
  mobile_contact: string | null;
  extra_tel: string | null;
  address: string | null;
  post_code: string | null;
  stripe_customer_id: string | null;
}

export interface ParentProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
}

export function useParentProfile() {
  const { ghostParent, isGhostMode } = useParentGhostMode();
  
  return useQuery({
    queryKey: ["parent-profile", isGhostMode ? ghostParent?.id : "self"],
    queryFn: async () => {
      // In ghost mode, use admin client to fetch the ghost parent's profile
      if (isGhostMode && ghostParent) {
        const { data, error } = await adminSupabase
          .from("parent_profiles")
          .select("*")
          .eq("id", ghostParent.id)
          .single();

        if (error) {
          console.error("Error fetching ghost parent profile:", error);
          return null;
        }

        return data as ParentProfile;
      }

      // Normal mode - use portal client
      const { data: { user } } = await portalSupabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await portalSupabase
        .from("parent_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching parent profile:", error);
        return null;
      }

      return data as ParentProfile;
    },
  });
}

export function useLinkedStudents() {
  const { ghostParent, isGhostMode } = useParentGhostMode();
  
  return useQuery({
    queryKey: ["linked-students", isGhostMode ? ghostParent?.id : "self"],
    queryFn: async () => {
      let parentId: string | null = null;
      
      // In ghost mode, use ghost parent ID
      if (isGhostMode && ghostParent) {
        parentId = ghostParent.id;
      } else {
        const { data: { user } } = await portalSupabase.auth.getUser();
        parentId = user?.id ?? null;
      }
      
      if (!parentId) return [];

      // Use admin client in ghost mode for RLS bypass
      const supabase = isGhostMode ? adminSupabase : portalSupabase;

      const { data: links, error: linksError } = await supabase
        .from("parent_student_links")
        .select("student_id")
        .eq("parent_id", parentId)
        .not("verified_at", "is", null);

      if (linksError) {
        console.error("Error fetching links:", linksError);
        return [];
      }

      if (!links || links.length === 0) return [];

      const studentIds = links.map(l => l.student_id);

      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select(`
          id, name, student_code, student_group, maktab, status,
          qaidah_level, quran_juz, quran_completed,
          tajweed_level, tajweed_completed,
          hifz_sabak, hifz_s_para, hifz_daur, hifz_graduated,
          juz_amma_surah, juz_amma_completed,
          duas_status,
          guardian_name, guardian_email, home_contact, mobile_contact, extra_tel,
          address, post_code, stripe_customer_id
        `)
        .in("id", studentIds);

      if (studentsError) {
        console.error("Error fetching students:", studentsError);
        return [];
      }

      return (students || []) as LinkedStudent[];
    },
  });
}

export function useStudentAttendance(studentId: string | null) {
  const { isGhostMode } = useParentGhostMode();
  
  return useQuery({
    queryKey: ["student-attendance", studentId, isGhostMode],
    queryFn: async () => {
      if (!studentId) return [];

      const supabase = isGhostMode ? adminSupabase : portalSupabase;

      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", studentId)
        .order("date", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching attendance:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!studentId,
  });
}

// Fetch attendance for multiple students
export function useMultiStudentAttendance(studentIds: string[]) {
  const { isGhostMode } = useParentGhostMode();
  
  return useQuery({
    queryKey: ["multi-student-attendance", studentIds, isGhostMode],
    queryFn: async () => {
      if (!studentIds || studentIds.length === 0) return [];

      const supabase = isGhostMode ? adminSupabase : portalSupabase;

      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
        .limit(500);

      if (error) {
        console.error("Error fetching attendance:", error);
        return [];
      }

      return data || [];
    },
    enabled: studentIds.length > 0,
  });
}

export function useParentNotifications() {
  const { ghostParent, isGhostMode } = useParentGhostMode();
  
  return useQuery({
    queryKey: ["parent-notifications", isGhostMode ? ghostParent?.id : "self"],
    queryFn: async () => {
      let parentId: string | null = null;
      
      if (isGhostMode && ghostParent) {
        parentId = ghostParent.id;
      } else {
        const { data: { user } } = await portalSupabase.auth.getUser();
        parentId = user?.id ?? null;
      }
      
      if (!parentId) return [];

      const supabase = isGhostMode ? adminSupabase : portalSupabase;

      const { data, error } = await supabase
        .from("parent_notifications")
        .select("*, students(name)")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }

      return data || [];
    },
  });
}
