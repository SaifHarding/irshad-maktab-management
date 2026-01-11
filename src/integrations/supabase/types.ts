export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string
          emails_failed: number | null
          emails_sent: number | null
          expires_at: string | null
          id: string
          image_url: string | null
          maktab_filter: string
          message: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_name: string
          emails_failed?: number | null
          emails_sent?: number | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          maktab_filter?: string
          message: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string
          emails_failed?: number | null
          emails_sent?: number | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          maktab_filter?: string
          message?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attendance_audit_logs: {
        Row: {
          action: string
          attendance_id: string
          created_at: string
          date: string
          id: string
          maktab: string
          old_status: string | null
          old_teacher_name: string | null
          performed_by: string
          performed_by_name: string
          status: string
          student_id: string
          student_name: string
          teacher_name: string
        }
        Insert: {
          action: string
          attendance_id: string
          created_at?: string
          date: string
          id?: string
          maktab: string
          old_status?: string | null
          old_teacher_name?: string | null
          performed_by: string
          performed_by_name: string
          status: string
          student_id: string
          student_name: string
          teacher_name: string
        }
        Update: {
          action?: string
          attendance_id?: string
          created_at?: string
          date?: string
          id?: string
          maktab?: string
          old_status?: string | null
          old_teacher_name?: string | null
          performed_by?: string
          performed_by_name?: string
          status?: string
          student_id?: string
          student_name?: string
          teacher_name?: string
        }
        Relationships: []
      }
      attendance_day_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          maktab: string
          performed_by: string
          performed_by_name: string
          student_count: number
          student_group: string
          teacher_name: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          maktab: string
          performed_by: string
          performed_by_name: string
          student_count?: number
          student_group: string
          teacher_name: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          maktab?: string
          performed_by?: string
          performed_by_name?: string
          student_count?: number
          student_group?: string
          teacher_name?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          created_at: string
          date: string
          id: string
          maktab: string
          status: string
          student_id: string
          teacher_name: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          maktab?: string
          status: string
          student_id: string
          teacher_name: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          maktab?: string
          status?: string
          student_id?: string
          teacher_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      maktab_classes: {
        Row: {
          code: string
          created_at: string | null
          display_order: number | null
          id: string
          label: string
          maktab: string
          name: string
          parent_group: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          label: string
          maktab: string
          name: string
          parent_group?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          label?: string
          maktab?: string
          name?: string
          parent_group?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      parent_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          maktab: string | null
          parent_email: string
          parent_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          maktab?: string | null
          parent_email: string
          parent_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          maktab?: string | null
          parent_email?: string
          parent_id?: string
        }
        Relationships: []
      }
      parent_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          parent_id: string
          student_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          parent_id: string
          student_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          parent_id?: string
          student_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      parent_student_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          relationship: string | null
          student_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          relationship?: string | null
          student_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          relationship?: string | null
          student_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_parent_links: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          student_code: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          student_code: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          student_code?: string
        }
        Relationships: []
      }
      pending_registrations: {
        Row: {
          address: string
          assigned_group: string | null
          created_at: string
          date_of_birth: string
          ethnic_origin: string | null
          first_name: string
          gender: string
          guardian_email: string
          guardian_name: string
          home_contact: string | null
          id: string
          last_name: string
          medical_notes: string | null
          middle_name: string | null
          mobile_contact: string
          mother_mobile: string | null
          mother_name: string | null
          place_of_birth: string
          post_code: string
          registration_type: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
        }
        Insert: {
          address: string
          assigned_group?: string | null
          created_at?: string
          date_of_birth: string
          ethnic_origin?: string | null
          first_name: string
          gender: string
          guardian_email: string
          guardian_name: string
          home_contact?: string | null
          id?: string
          last_name: string
          medical_notes?: string | null
          middle_name?: string | null
          mobile_contact: string
          mother_mobile?: string | null
          mother_name?: string | null
          place_of_birth: string
          post_code: string
          registration_type?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
        }
        Update: {
          address?: string
          assigned_group?: string | null
          created_at?: string
          date_of_birth?: string
          ethnic_origin?: string | null
          first_name?: string
          gender?: string
          guardian_email?: string
          guardian_name?: string
          home_contact?: string | null
          id?: string
          last_name?: string
          medical_notes?: string | null
          middle_name?: string | null
          mobile_contact?: string
          mother_mobile?: string | null
          mother_name?: string | null
          place_of_birth?: string
          post_code?: string
          registration_type?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_head_teacher: boolean
          maktab: string | null
          must_change_password: boolean
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_head_teacher?: boolean
          maktab?: string | null
          must_change_password?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_head_teacher?: boolean
          maktab?: string | null
          must_change_password?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      progress_audit_logs: {
        Row: {
          created_at: string
          field_changed: string
          id: string
          maktab: string
          new_value: string | null
          old_value: string | null
          performed_by: string
          performed_by_name: string
          student_group: string | null
          student_id: string
          student_name: string
        }
        Insert: {
          created_at?: string
          field_changed: string
          id?: string
          maktab: string
          new_value?: string | null
          old_value?: string | null
          performed_by: string
          performed_by_name: string
          student_group?: string | null
          student_id: string
          student_name: string
        }
        Update: {
          created_at?: string
          field_changed?: string
          id?: string
          maktab?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string
          performed_by_name?: string
          student_group?: string | null
          student_id?: string
          student_name?: string
        }
        Relationships: []
      }
      reminder_mute_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          maktab: string | null
          reason: string
          start_date: string
          teacher_name: string | null
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          maktab?: string | null
          reason: string
          start_date: string
          teacher_name?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          maktab?: string | null
          reason?: string
          start_date?: string
          teacher_name?: string | null
        }
        Relationships: []
      }
      star_student_snapshots: {
        Row: {
          created_at: string
          id: string
          maktab: string
          snapshot_month: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          maktab: string
          snapshot_month: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          maktab?: string
          snapshot_month?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "star_student_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          maktab: string
          performed_by: string
          performed_by_name: string
          student_id: string
          student_name: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          maktab: string
          performed_by: string
          performed_by_name: string
          student_id: string
          student_name: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          maktab?: string
          performed_by?: string
          performed_by_name?: string
          student_id?: string
          student_name?: string
        }
        Relationships: []
      }
      student_code_counters: {
        Row: {
          last_num: number
          prefix: string
          updated_at: string
        }
        Insert: {
          last_num?: number
          prefix: string
          updated_at?: string
        }
        Update: {
          last_num?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_progress_snapshots: {
        Row: {
          created_at: string
          duas_status: string | null
          hifz_daur: number | null
          hifz_graduated: boolean | null
          hifz_s_para: number | null
          hifz_sabak: number | null
          id: string
          juz_amma_completed: boolean | null
          juz_amma_surah: number | null
          maktab: string
          qaidah_level: number | null
          quran_completed: boolean | null
          quran_juz: number | null
          snapshot_month: string
          student_group: string | null
          student_id: string
          tajweed_completed: boolean | null
          tajweed_level: number | null
        }
        Insert: {
          created_at?: string
          duas_status?: string | null
          hifz_daur?: number | null
          hifz_graduated?: boolean | null
          hifz_s_para?: number | null
          hifz_sabak?: number | null
          id?: string
          juz_amma_completed?: boolean | null
          juz_amma_surah?: number | null
          maktab: string
          qaidah_level?: number | null
          quran_completed?: boolean | null
          quran_juz?: number | null
          snapshot_month: string
          student_group?: string | null
          student_id: string
          tajweed_completed?: boolean | null
          tajweed_level?: number | null
        }
        Update: {
          created_at?: string
          duas_status?: string | null
          hifz_daur?: number | null
          hifz_graduated?: boolean | null
          hifz_s_para?: number | null
          hifz_sabak?: number | null
          id?: string
          juz_amma_completed?: boolean | null
          juz_amma_surah?: number | null
          maktab?: string
          qaidah_level?: number | null
          quran_completed?: boolean | null
          quran_juz?: number | null
          snapshot_month?: string
          student_group?: string | null
          student_id?: string
          tajweed_completed?: boolean | null
          tajweed_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string | null
          assigned_teacher: string | null
          billing_email: string | null
          created_at: string
          date_of_birth: string | null
          duas_status: string | null
          ethnic_origin: string | null
          extra_tel: string | null
          gender: string | null
          guardian_email: string | null
          guardian_name: string | null
          hifz_daur: number | null
          hifz_graduated: boolean | null
          hifz_s_para: number | null
          hifz_sabak: number | null
          home_contact: string | null
          house_number: string | null
          id: string
          juz_amma_completed: boolean | null
          juz_amma_surah: number | null
          last_madrasa: string | null
          last_madrasa_address: string | null
          last_progress_month: string | null
          maktab: string
          medical_notes: string | null
          mobile_contact: string | null
          name: string
          other_language: string | null
          place_of_birth: string | null
          portal_invite_email: string | null
          portal_invite_sent_at: string | null
          post_code: string | null
          progress_due_month: string | null
          progress_due_since_date: string | null
          qaidah_level: number | null
          quran_completed: boolean | null
          quran_juz: number | null
          reading_level: string | null
          reason_for_leaving: string | null
          status: string
          stripe_customer_id: string | null
          student_code: string | null
          student_group: string | null
          tajweed_completed: boolean | null
          tajweed_level: number | null
          year_group: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          assigned_teacher?: string | null
          billing_email?: string | null
          created_at?: string
          date_of_birth?: string | null
          duas_status?: string | null
          ethnic_origin?: string | null
          extra_tel?: string | null
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          hifz_daur?: number | null
          hifz_graduated?: boolean | null
          hifz_s_para?: number | null
          hifz_sabak?: number | null
          home_contact?: string | null
          house_number?: string | null
          id?: string
          juz_amma_completed?: boolean | null
          juz_amma_surah?: number | null
          last_madrasa?: string | null
          last_madrasa_address?: string | null
          last_progress_month?: string | null
          maktab?: string
          medical_notes?: string | null
          mobile_contact?: string | null
          name: string
          other_language?: string | null
          place_of_birth?: string | null
          portal_invite_email?: string | null
          portal_invite_sent_at?: string | null
          post_code?: string | null
          progress_due_month?: string | null
          progress_due_since_date?: string | null
          qaidah_level?: number | null
          quran_completed?: boolean | null
          quran_juz?: number | null
          reading_level?: string | null
          reason_for_leaving?: string | null
          status?: string
          stripe_customer_id?: string | null
          student_code?: string | null
          student_group?: string | null
          tajweed_completed?: boolean | null
          tajweed_level?: number | null
          year_group?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          assigned_teacher?: string | null
          billing_email?: string | null
          created_at?: string
          date_of_birth?: string | null
          duas_status?: string | null
          ethnic_origin?: string | null
          extra_tel?: string | null
          gender?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          hifz_daur?: number | null
          hifz_graduated?: boolean | null
          hifz_s_para?: number | null
          hifz_sabak?: number | null
          home_contact?: string | null
          house_number?: string | null
          id?: string
          juz_amma_completed?: boolean | null
          juz_amma_surah?: number | null
          last_madrasa?: string | null
          last_madrasa_address?: string | null
          last_progress_month?: string | null
          maktab?: string
          medical_notes?: string | null
          mobile_contact?: string | null
          name?: string
          other_language?: string | null
          place_of_birth?: string | null
          portal_invite_email?: string | null
          portal_invite_sent_at?: string | null
          post_code?: string | null
          progress_due_month?: string | null
          progress_due_since_date?: string | null
          qaidah_level?: number | null
          quran_completed?: boolean | null
          quran_juz?: number | null
          reading_level?: string | null
          reason_for_leaving?: string | null
          status?: string
          stripe_customer_id?: string | null
          student_code?: string | null
          student_group?: string | null
          tajweed_completed?: boolean | null
          tajweed_level?: number | null
          year_group?: string | null
        }
        Relationships: []
      }
      teacher_attendance: {
        Row: {
          auto_marked: boolean
          created_at: string
          date: string
          id: string
          maktab: string
          marked_by: string
          marked_by_name: string
          status: string
          teacher_name: string
          updated_at: string
        }
        Insert: {
          auto_marked?: boolean
          created_at?: string
          date?: string
          id?: string
          maktab: string
          marked_by: string
          marked_by_name: string
          status?: string
          teacher_name: string
          updated_at?: string
        }
        Update: {
          auto_marked?: boolean
          created_at?: string
          date?: string
          id?: string
          maktab?: string
          marked_by?: string
          marked_by_name?: string
          status?: string
          teacher_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_attendance_notes: {
        Row: {
          created_at: string
          date: string
          id: string
          maktab: string
          note: string
          note_type: string
          teacher_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          maktab: string
          note: string
          note_type?: string
          teacher_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          maktab?: string
          note?: string
          note_type?: string
          teacher_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_groups: {
        Row: {
          created_at: string
          group_code: string
          id: string
          maktab: string
          teacher_name: string
        }
        Insert: {
          created_at?: string
          group_code: string
          id?: string
          maktab?: string
          teacher_name: string
        }
        Update: {
          created_at?: string
          group_code?: string
          id?: string
          maktab?: string
          teacher_name?: string
        }
        Relationships: []
      }
      teacher_reminders: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          maktab: string
          notification_email: string
          reminder_days: string[]
          reminder_time: string
          teacher_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          maktab: string
          notification_email: string
          reminder_days?: string[]
          reminder_time?: string
          teacher_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          maktab?: string
          notification_email?: string
          reminder_days?: string[]
          reminder_time?: string
          teacher_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_events: {
        Row: {
          created_at: string
          created_by: string
          created_by_name: string
          description: string | null
          display_order: number
          event_date: string | null
          event_end_date: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_name: string
          description?: string | null
          display_order?: number
          event_date?: string | null
          event_end_date?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_name?: string
          description?: string | null
          display_order?: number
          event_date?: string | null
          event_end_date?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_student_code: { Args: { p_maktab: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "parent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "parent"],
    },
  },
} as const
