import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PendingRegistration {
  id: string;
  created_at: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  place_of_birth: string;
  gender: string;
  address: string;
  post_code: string;
  home_contact: string | null;
  mobile_contact: string;
  guardian_email: string;
  guardian_name: string;
  ethnic_origin: string | null;
  status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  rejection_reason: string | null;
  registration_type: string;
  assigned_group: string | null;
  mother_mobile: string | null;
  mother_name: string | null;
  medical_notes: string | null;
}

export interface GroupedRegistrations {
  guardianEmail: string;
  guardianName: string;
  registrations: PendingRegistration[];
}

export function usePendingRegistrations() {
  const queryClient = useQueryClient();

  const { data: pendingRegistrations = [], isLoading } = useQuery({
    queryKey: ["pending-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_registrations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingRegistration[];
    },
  });

  // Group registrations by guardian email
  const groupedRegistrations: GroupedRegistrations[] = pendingRegistrations.reduce((acc, reg) => {
    const emailLower = reg.guardian_email.toLowerCase();
    const existing = acc.find(g => g.guardianEmail.toLowerCase() === emailLower);
    if (existing) {
      existing.registrations.push(reg);
    } else {
      acc.push({
        guardianEmail: reg.guardian_email,
        guardianName: reg.guardian_name,
        registrations: [reg],
      });
    }
    return acc;
  }, [] as GroupedRegistrations[]);

  const { data: registrationHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["registration-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_registrations")
        .select("*")
        .neq("status", "pending")
        .order("reviewed_at", { ascending: false });

      if (error) throw error;
      return data as PendingRegistration[];
    },
  });

  const approveRegistration = useMutation({
    mutationFn: async ({ 
      registration, 
      reviewerName,
      maktab,
      studentGroup: selectedGroup,
    }: { 
      registration: PendingRegistration; 
      reviewerName: string;
      maktab: string;
      studentGroup: string | null;
    }) => {
      // Build full name
      const nameParts = [registration.first_name];
      if (registration.middle_name) {
        nameParts.push(registration.middle_name);
      }
      nameParts.push(registration.last_name);
      const fullName = nameParts.join(" ");

      // For Hifz registrations, auto-assign Group C and boys maktab
      const isHifz = registration.registration_type === "hifz";
      const finalMaktab = isHifz ? "boys" : maktab;
      const studentGroup = isHifz ? "C" : selectedGroup;

      // Insert into students table with pending_payment status
      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          name: fullName,
          maktab: finalMaktab,
          student_group: studentGroup,
          gender: registration.gender,
          date_of_birth: registration.date_of_birth,
          place_of_birth: registration.place_of_birth,
          address: registration.address,
          post_code: registration.post_code,
          home_contact: registration.home_contact,
          mobile_contact: registration.mobile_contact,
          guardian_email: registration.guardian_email,
          guardian_name: registration.guardian_name,
          ethnic_origin: registration.ethnic_origin,
          status: "pending_payment",
          admission_date: new Date().toISOString().split("T")[0],
        })
        .select("id, student_code, name, guardian_email")
        .single();

      if (studentError) throw studentError;


      // Update pending registration status with assigned group
      const { error: updateError } = await supabase
        .from("pending_registrations")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by_name: reviewerName,
          assigned_group: studentGroup,
        })
        .eq("id", registration.id);

      if (updateError) {
        // Best-effort rollback to avoid creating duplicate students if approval fails
        try {
          await supabase.from("students").delete().eq("id", student.id);
        } catch {
          // ignore rollback failure
        }
        throw updateError;
      }

      // Send payment link to guardian
      try {
        const { error: paymentError } = await supabase.functions.invoke(
          "send-payment-link",
          {
            body: {
              studentId: student.id,
              guardianEmail: registration.guardian_email,
              studentName: fullName,
              maktab: finalMaktab,
            },
          }
        );

        if (paymentError) {
          console.error("Failed to send payment link:", paymentError);
          // Don't throw - registration was successful, just payment link failed
        }
      } catch (paymentErr) {
        console.error("Error invoking payment link function:", paymentErr);
        // Don't throw - registration was successful, just payment link failed
      }

      return { ...student, maktab: finalMaktab };
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registration-history"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${student.name} approved - payment link sent to guardian`);
    },
    onError: (error: any) => {
      const msg =
        error?.details ||
        error?.hint ||
        error?.message ||
        error?.error_description ||
        (typeof error === "string" ? error : "Unknown error");
      const code = error?.code ? ` (${error.code})` : "";

      const raw = (() => {
        try {
          return typeof error === "string" ? error : JSON.stringify(error);
        } catch {
          return String(error);
        }
      })();

      console.error("Approval error:", error);
      toast.error(`Failed to approve registration${code}: ${msg}`, {
        description: raw.length > 300 ? raw.slice(0, 300) + "…" : raw,
      });
    },
  });

  // Batch approve multiple registrations from same guardian
  const batchApproveRegistrations = useMutation({
    mutationFn: async ({ 
      registrations, 
      reviewerName,
      groupAssignments,
    }: { 
      registrations: PendingRegistration[]; 
      reviewerName: string;
      groupAssignments: Record<string, string>; // registration.id -> group
    }) => {
      const approvedStudents: { id: string; name: string; code: string; maktab: string; guardianEmail: string; isHifz: boolean }[] = [];
      const createdStudentIds: string[] = [];

      // Process each registration
      for (const registration of registrations) {
        const nameParts = [registration.first_name];
        if (registration.middle_name) {
          nameParts.push(registration.middle_name);
        }
        nameParts.push(registration.last_name);
        const fullName = nameParts.join(" ");

        const isHifz = registration.registration_type === "hifz";
        const maktab = registration.gender.toLowerCase() === "male" ? "boys" : "girls";
        const finalMaktab = isHifz ? "boys" : maktab;
        const studentGroup = isHifz ? "C" : groupAssignments[registration.id];

        // Insert student with pending_payment status
        const { data: student, error: studentError } = await supabase
          .from("students")
          .insert({
            name: fullName,
            maktab: finalMaktab,
            student_group: studentGroup,
            gender: registration.gender,
            date_of_birth: registration.date_of_birth,
            place_of_birth: registration.place_of_birth,
            address: registration.address,
            post_code: registration.post_code,
            home_contact: registration.home_contact,
            mobile_contact: registration.mobile_contact,
            guardian_email: registration.guardian_email,
            guardian_name: registration.guardian_name,
            ethnic_origin: registration.ethnic_origin,
            status: "pending_payment",
            admission_date: new Date().toISOString().split("T")[0],
          })
          .select("id, student_code, name, guardian_email")
          .single();

        if (studentError) {
          // Rollback previously created students
          for (const id of createdStudentIds) {
            await supabase.from("students").delete().eq("id", id);
          }
          throw studentError;
        }

        createdStudentIds.push(student.id);

        // Update pending registration
        const { error: updateError } = await supabase
          .from("pending_registrations")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by_name: reviewerName,
            assigned_group: studentGroup,
          })
          .eq("id", registration.id);

        if (updateError) {
          // Rollback all created students
          for (const id of createdStudentIds) {
            await supabase.from("students").delete().eq("id", id);
          }
          throw updateError;
        }

        approvedStudents.push({
          id: student.id,
          name: fullName,
          code: student.student_code,
          maktab: finalMaktab,
          guardianEmail: registration.guardian_email,
          isHifz,
        });
      }

      // Group students by maktab for combined payment links
      const studentsByMaktab = approvedStudents.reduce((acc, student) => {
        if (!acc[student.maktab]) {
          acc[student.maktab] = [];
        }
        acc[student.maktab].push(student);
        return acc;
      }, {} as Record<string, typeof approvedStudents>);

      const maktabs = Object.keys(studentsByMaktab);
      const hasMultipleMaktabs = maktabs.length > 1;

      // Send one combined payment link per maktab
      for (const maktab of maktabs) {
        const maktabStudents = studentsByMaktab[maktab];
        const guardianEmail = maktabStudents[0].guardianEmail;
        
        try {
          const { error: paymentError } = await supabase.functions.invoke(
            "send-payment-link",
            {
              body: {
                students: maktabStudents.map(s => ({
                  studentId: s.id,
                  studentName: s.name,
                })),
                guardianEmail,
                maktab,
                siblingCount: approvedStudents.length, // Total siblings for discount calculation
                hasOtherMaktabRegistration: hasMultipleMaktabs,
              },
            }
          );

          if (paymentError) {
            console.error(`Failed to send payment link for ${maktab} students:`, paymentError);
          }
        } catch (paymentErr) {
          console.error(`Error invoking payment link function for ${maktab}:`, paymentErr);
        }
      }

      return approvedStudents;
    },
    onSuccess: (students) => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registration-history"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      const names = students.map(s => s.name).join(", ");
      toast.success(`${students.length} student${students.length > 1 ? 's' : ''} approved - payment links sent: ${names}`);
    },
    onError: (error: any) => {
      const msg =
        error?.details ||
        error?.hint ||
        error?.message ||
        error?.error_description ||
        (typeof error === "string" ? error : "Unknown error");
      const code = error?.code ? ` (${error.code})` : "";

      console.error("Batch approval error:", error);
      toast.error(`Failed to approve registrations${code}: ${msg}`);
    },
  });

  const rejectRegistration = useMutation({
    mutationFn: async ({ 
      registrationId, 
      reviewerName,
      reason,
      guardianEmail,
      guardianName,
      studentName,
    }: { 
      registrationId: string; 
      reviewerName: string;
      reason: string;
      guardianEmail: string;
      guardianName: string;
      studentName: string;
    }) => {
      // Update registration status
      const { error } = await supabase
        .from("pending_registrations")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by_name: reviewerName,
          rejection_reason: reason,
        })
        .eq("id", registrationId);

      if (error) throw error;

      // Send rejection email
      try {
        const { error: emailError } = await supabase.functions.invoke(
          "send-registration-rejection",
          {
            body: {
              guardianEmail,
              guardianName,
              studentName,
              rejectionReason: reason,
            },
          }
        );
        if (emailError) {
          console.error("Failed to send rejection email:", emailError);
        }
      } catch (emailErr) {
        console.error("Error invoking rejection email function:", emailErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registration-history"] });
      toast.success("Registration rejected and email sent to guardian");
    },
    onError: (error) => {
      console.error("Rejection error:", error);
      toast.error("Failed to reject registration");
    },
  });

  const deleteHistoryEntry = useMutation({
    mutationFn: async ({ registrationId }: { registrationId: string }) => {
      const { error } = await supabase
        .from("pending_registrations")
        .delete()
        .eq("id", registrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-history"] });
      toast.success("Registration history entry removed");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to remove registration history entry");
    },
  });

  return {
    pendingRegistrations,
    groupedRegistrations,
    isLoading,
    pendingCount: pendingRegistrations.length,
    registrationHistory,
    isLoadingHistory,
    approveRegistration,
    batchApproveRegistrations,
    rejectRegistration,
    deleteHistoryEntry,
  };
}
