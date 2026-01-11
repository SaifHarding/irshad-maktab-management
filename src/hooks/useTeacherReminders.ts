import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeacherReminder {
  id: string;
  teacher_name: string;
  maktab: string;
  reminder_time: string;
  reminder_days: string[];
  notification_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReminderMutePeriod {
  id: string;
  maktab: string | null;
  teacher_name: string | null;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
}

export const useTeacherReminders = () => {
  return useQuery({
    queryKey: ["teacher-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_reminders")
        .select("*")
        .order("maktab", { ascending: true })
        .order("teacher_name", { ascending: true });

      if (error) throw error;
      return data as TeacherReminder[];
    },
  });
};

export const useMutePeriods = () => {
  return useQuery({
    queryKey: ["reminder-mute-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminder_mute_periods")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data as ReminderMutePeriod[];
    },
  });
};

export const useSaveReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminder: Omit<TeacherReminder, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("teacher_reminders")
        .upsert(reminder, { onConflict: "teacher_name,maktab" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-reminders"] });
    },
  });
};

export const useUpdateReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TeacherReminder> & { id: string }) => {
      const { data, error } = await supabase
        .from("teacher_reminders")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-reminders"] });
    },
  });
};

export const useDeleteReminder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("teacher_reminders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-reminders"] });
    },
  });
};

export const useSaveMutePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mutePeriod: Omit<ReminderMutePeriod, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("reminder_mute_periods")
        .insert(mutePeriod)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder-mute-periods"] });
    },
  });
};

export const useDeleteMutePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reminder_mute_periods")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder-mute-periods"] });
    },
  });
};
