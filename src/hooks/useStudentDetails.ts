import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface StudentDetails {
  id: string;
  name: string;
  student_code: string | null;
  student_group: string | null;
  assigned_teacher: string | null;
  gender: string | null;
  status: string | null;
  maktab: string;
  created_at: string;
  
  // Personal Information
  date_of_birth: string | null;
  year_group: string | null;
  
  // Contact Address
  house_number: string | null;
  address: string | null;
  post_code: string | null;
  
  // Demographics
  ethnic_origin: string | null;
  other_language: string | null;
  
  // Guardian Information
  guardian_name: string | null;
  guardian_email: string | null;
  home_contact: string | null;
  mobile_contact: string | null;
  extra_tel: string | null;
  
  // Previous Education
  last_madrasa: string | null;
  last_madrasa_address: string | null;
  reason_for_leaving: string | null;
  
  // Academic & Health
  reading_level: string | null;
  medical_notes: string | null;
  
  // Dates
  admission_date: string | null;
  
  // Progress fields
  qaidah_level: number | null;
  duas_status: string | null;
  quran_juz: number | null;
  quran_completed: boolean | null;
  tajweed_level: number | null;
  tajweed_completed: boolean | null;
  hifz_sabak: number | null;
  hifz_s_para: number | null;
  hifz_daur: number | null;
  hifz_graduated: boolean | null;
  
  // Stripe/Billing fields
  stripe_customer_id: string | null;
  billing_email: string | null;
  
  // Portal invite tracking
  portal_invite_email: string | null;
  portal_invite_sent_at: string | null;
}

export const useStudentDetails = (studentId: string | null) => {
  const queryClient = useQueryClient();

  const { data: student, isLoading } = useQuery({
    queryKey: ["student-details", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();
      
      if (error) throw error;
      return data as StudentDetails | null;
    },
    enabled: !!studentId,
  });

  const updateStudent = useMutation({
    mutationFn: async (updates: Partial<StudentDetails>) => {
      if (!studentId) throw new Error("Student ID is required");
      
      const { data, error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", studentId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-details", studentId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["all-students-directory"] });
      
      toast({
        title: "Student updated",
        description: "Student details have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update student details. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating student:", error);
    },
  });

  const transferMaktab = useMutation({
    mutationFn: async (newMaktab: "boys" | "girls") => {
      if (!studentId) throw new Error("Student ID is required");
      
      // First, generate a new student code for the target maktab
      const { data: newCode, error: codeError } = await supabase
        .rpc("generate_student_code", { p_maktab: newMaktab });
      
      if (codeError) throw codeError;
      
      // Update the student with new maktab and code
      const { data, error } = await supabase
        .from("students")
        .update({ 
          maktab: newMaktab,
          student_code: newCode 
        })
        .eq("id", studentId)
        .select()
        .single();
      
      if (error) throw error;
      return { data, newCode };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["student-details", studentId] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["all-students-directory"] });
      
      toast({
        title: "Student transferred",
        description: `Student has been moved to the ${result.data.maktab === "boys" ? "Boys" : "Girls"} Maktab with new code: ${result.newCode}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Transfer failed",
        description: "Failed to transfer student. Please try again.",
        variant: "destructive",
      });
      console.error("Error transferring student:", error);
    },
  });

  return {
    student,
    isLoading,
    updateStudent: updateStudent.mutate,
    isUpdating: updateStudent.isPending,
    transferMaktab: transferMaktab.mutate,
    isTransferring: transferMaktab.isPending,
  };
};

export const useAllStudentsDirectory = (maktab?: "boys" | "girls", status?: string) => {
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["all-students-directory", maktab, status],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("id, name, student_code, student_group, maktab, status, gender, date_of_birth, guardian_name, admission_date, stripe_customer_id")
        .order("name");
      
      if (maktab) {
        query = query.eq("maktab", maktab);
      }
      
      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });

  return { students, isLoading };
};
