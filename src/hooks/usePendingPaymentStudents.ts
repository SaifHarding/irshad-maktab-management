import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PendingPaymentStudent {
  id: string;
  name: string;
  maktab: string;
  student_group: string | null;
  gender: string | null;
  date_of_birth: string | null;
  guardian_email: string | null;
  guardian_name: string | null;
  mobile_contact: string | null;
  address: string | null;
  post_code: string | null;
  medical_notes: string | null;
  status: string;
  created_at: string;
  student_code: string | null;
  stripe_customer_id: string | null;
}

export function usePendingPaymentStudents(maktab?: string) {
  const queryClient = useQueryClient();

  const { data: pendingPaymentStudents = [], isLoading } = useQuery({
    queryKey: ["pending-payment-students", maktab],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("*")
        .eq("status", "pending_payment")
        .order("created_at", { ascending: false });

      if (maktab) {
        query = query.eq("maktab", maktab);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PendingPaymentStudent[];
    },
  });

  // Group by guardian email
  const groupedByGuardian = pendingPaymentStudents.reduce((acc, student) => {
    const email = student.guardian_email?.toLowerCase() || "unknown";
    if (!acc[email]) {
      acc[email] = {
        guardianEmail: student.guardian_email || "Unknown",
        guardianName: student.guardian_name || "Unknown",
        students: [],
      };
    }
    acc[email].students.push(student);
    return acc;
  }, {} as Record<string, { guardianEmail: string; guardianName: string; students: PendingPaymentStudent[] }>);

  const groupedStudents = Object.values(groupedByGuardian);

  // Manual approval - bypasses payment requirement
  const manualApprove = useMutation({
    mutationFn: async ({
      studentId,
      approverName,
      approvalReason,
    }: {
      studentId: string;
      approverName: string;
      approvalReason: string;
    }) => {
      // Update student status to active and fetch full data for email
      const { data: student, error } = await supabase
        .from("students")
        .update({
          status: "active",
        })
        .eq("id", studentId)
        .select("id, name, maktab, guardian_email, guardian_name, student_code")
        .single();

      if (error) throw error;

      // Log the manual approval in student_audit_logs
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("student_audit_logs").insert({
          student_id: studentId,
          student_name: student.name,
          maktab: student.maktab,
          action: `Manual approval (payment bypassed): ${approvalReason}`,
          performed_by: user.id,
          performed_by_name: approverName,
        });
      }

      // Send confirmation email to parent
      if (student.guardian_email) {
        try {
          await supabase.functions.invoke("send-payment-confirmation", {
            body: {
              guardianEmail: student.guardian_email,
              guardianName: student.guardian_name || "Parent/Guardian",
              studentName: student.name,
              studentCode: student.student_code || "N/A",
              maktab: student.maktab,
            },
          });
          console.log(`Confirmation email sent to ${student.guardian_email}`);
        } catch (emailErr) {
          console.error("Error sending confirmation email:", emailErr);
          // Don't fail the approval if email fails
        }
      }

      return student;
    },
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["pending-payment-students"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${student.name} manually approved and is now active`);
    },
    onError: (error: any) => {
      console.error("Manual approval error:", error);
      toast.error("Failed to approve student: " + (error.message || "Unknown error"));
    },
  });

  // Resend payment link
  const resendPaymentLink = useMutation({
    mutationFn: async ({
      student,
    }: {
      student: PendingPaymentStudent;
    }) => {
      if (!student.guardian_email) {
        throw new Error("No guardian email on file");
      }

      const { error } = await supabase.functions.invoke("send-payment-link", {
        body: {
          studentId: student.id,
          guardianEmail: student.guardian_email,
          studentName: student.name,
          maktab: student.maktab,
        },
      });

      if (error) throw error;
      return student;
    },
    onSuccess: (student) => {
      toast.success(`Payment link resent to ${student.guardian_email}`);
    },
    onError: (error: any) => {
      console.error("Resend payment link error:", error);
      toast.error("Failed to resend payment link: " + (error.message || "Unknown error"));
    },
  });

  // Delete student (cancel registration)
  const cancelRegistration = useMutation({
    mutationFn: async ({
      studentId,
      studentName,
      maktab: studentMaktab,
      cancellerName,
      cancelReason,
    }: {
      studentId: string;
      studentName: string;
      maktab: string;
      cancellerName: string;
      cancelReason: string;
    }) => {
      // Log the cancellation first
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("student_audit_logs").insert({
          student_id: studentId,
          student_name: studentName,
          maktab: studentMaktab,
          action: `Registration cancelled: ${cancelReason}`,
          performed_by: user.id,
          performed_by_name: cancellerName,
        });
      }

      // Delete the student
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId);

      if (error) throw error;
      return { name: studentName };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pending-payment-students"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${result.name}'s registration has been cancelled`);
    },
    onError: (error: any) => {
      console.error("Cancel registration error:", error);
      toast.error("Failed to cancel registration: " + (error.message || "Unknown error"));
    },
  });

  // Batch manual approval - approve multiple students at once
  const batchManualApprove = useMutation({
    mutationFn: async ({
      students,
      approverName,
      approvalReason,
    }: {
      students: PendingPaymentStudent[];
      approverName: string;
      approvalReason: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const results: { name: string; guardian_email: string | null }[] = [];

      for (const student of students) {
        // Update student status to active
        const { data: updatedStudent, error } = await supabase
          .from("students")
          .update({ status: "active" })
          .eq("id", student.id)
          .select("id, name, maktab, guardian_email, guardian_name, student_code")
          .single();

        if (error) throw error;

        // Log the manual approval
        if (user) {
          await supabase.from("student_audit_logs").insert({
            student_id: student.id,
            student_name: updatedStudent.name,
            maktab: updatedStudent.maktab,
            action: `Manual approval (payment bypassed): ${approvalReason}`,
            performed_by: user.id,
            performed_by_name: approverName,
          });
        }

        results.push({
          name: updatedStudent.name,
          guardian_email: updatedStudent.guardian_email,
        });
      }

      // Send one confirmation email per guardian (they're all from the same guardian in batch)
      const firstStudent = students[0];
      if (firstStudent.guardian_email) {
        try {
          const studentNames = results.map(r => r.name).join(", ");
          await supabase.functions.invoke("send-payment-confirmation", {
            body: {
              guardianEmail: firstStudent.guardian_email,
              guardianName: firstStudent.guardian_name || "Parent/Guardian",
              studentName: studentNames,
              studentCode: "Multiple students",
              maktab: firstStudent.maktab,
            },
          });
          console.log(`Confirmation email sent to ${firstStudent.guardian_email} for ${results.length} students`);
        } catch (emailErr) {
          console.error("Error sending confirmation email:", emailErr);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["pending-payment-students"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${results.length} students manually approved and are now active`);
    },
    onError: (error: any) => {
      console.error("Batch manual approval error:", error);
      toast.error("Failed to approve students: " + (error.message || "Unknown error"));
    },
  });

  return {
    pendingPaymentStudents,
    groupedStudents,
    isLoading,
    count: pendingPaymentStudents.length,
    manualApprove,
    batchManualApprove,
    resendPaymentLink,
    cancelRegistration,
  };
}
