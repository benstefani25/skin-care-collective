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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          id: string
          member_id: string
          room: string | null
          slot_id: string
          source: string
          status: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          id?: string
          member_id: string
          room?: string | null
          slot_id: string
          source: string
          status?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          id?: string
          member_id?: string
          room?: string | null
          slot_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_ledger: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          created_at: string
          id: string
          note: string | null
          semester: string
          tech_id: string
          type: string
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          semester: string
          tech_id: string
          type: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          semester?: string
          tech_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_ledger_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_ledger_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "tech_runsheet"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "bonus_ledger_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "techs"
            referencedColumns: ["id"]
          },
        ]
      }
      digests: {
        Row: {
          body: string
          created_at: string
          data: Json
          generated_by: string
          id: string
          period_end: string
          period_start: string
        }
        Insert: {
          body?: string
          created_at?: string
          data?: Json
          generated_by?: string
          id?: string
          period_end: string
          period_start: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          generated_by?: string
          id?: string
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          actor_id: string | null
          actor_type: string
          appointment_id: string | null
          created_at: string
          house_id: string | null
          id: string
          member_id: string | null
          payload: Json
          tech_id: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          appointment_id?: string | null
          created_at?: string
          house_id?: string | null
          id?: string
          member_id?: string | null
          payload?: Json
          tech_id?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          appointment_id?: string | null
          created_at?: string
          house_id?: string | null
          id?: string
          member_id?: string | null
          payload?: Json
          tech_id?: string | null
          type?: string
        }
        Relationships: []
      }
      house_contacts: {
        Row: {
          contact: string | null
          created_at: string
          house_id: string
          id: string
          name: string
          notes: string | null
          role: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          house_id: string
          id?: string
          name: string
          notes?: string | null
          role: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          house_id?: string
          id?: string
          name?: string
          notes?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "house_contacts_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          access_notes: string
          address: string
          campus: string
          created_at: string
          house_director_contact: string | null
          house_director_name: string | null
          id: string
          insurance_note: string | null
          minimum_wage_cents: number | null
          monthly_price_cents: number
          name: string
          signup_token: string
          slot_duration_minutes: number
          status: string
          timezone: string
          visit_cadence: string
          visit_weekday: number
          visit_window_end: string
          visit_window_start: string
        }
        Insert: {
          access_notes?: string
          address?: string
          campus: string
          created_at?: string
          house_director_contact?: string | null
          house_director_name?: string | null
          id?: string
          insurance_note?: string | null
          minimum_wage_cents?: number | null
          monthly_price_cents?: number
          name: string
          signup_token?: string
          slot_duration_minutes?: number
          status?: string
          timezone?: string
          visit_cadence?: string
          visit_weekday: number
          visit_window_end: string
          visit_window_start: string
        }
        Update: {
          access_notes?: string
          address?: string
          campus?: string
          created_at?: string
          house_director_contact?: string | null
          house_director_name?: string | null
          id?: string
          insurance_note?: string | null
          minimum_wage_cents?: number | null
          monthly_price_cents?: number
          name?: string
          signup_token?: string
          slot_duration_minutes?: number
          status?: string
          timezone?: string
          visit_cadence?: string
          visit_weekday?: number
          visit_window_end?: string
          visit_window_start?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string | null
          email: string
          first_name: string
          graduation_year: number | null
          house_id: string
          id: string
          is_liaison: boolean
          last_name: string
          phone: string
          referral_code: string | null
          referred_by_member_id: string | null
          service_notes: string | null
          shade_preference: string | null
          standing_appointment: boolean
          standing_window: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          first_name: string
          graduation_year?: number | null
          house_id: string
          id?: string
          is_liaison?: boolean
          last_name: string
          phone: string
          referral_code?: string | null
          referred_by_member_id?: string | null
          service_notes?: string | null
          shade_preference?: string | null
          standing_appointment?: boolean
          standing_window?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string
          graduation_year?: number | null
          house_id?: string
          id?: string
          is_liaison?: boolean
          last_name?: string
          phone?: string
          referral_code?: string | null
          referred_by_member_id?: string | null
          service_notes?: string | null
          shade_preference?: string | null
          standing_appointment?: boolean
          standing_window?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_referred_by_member_id_fkey"
            columns: ["referred_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          direction: string
          escalated: boolean
          handled_by: string | null
          id: string
          member_id: string | null
          tech_id: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          direction: string
          escalated?: boolean
          handled_by?: string | null
          id?: string
          member_id?: string | null
          tech_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          escalated?: boolean
          handled_by?: string | null
          id?: string
          member_id?: string | null
          tech_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "techs"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhooks: {
        Row: {
          created_at: string
          external_id: string
          id: string
          provider: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          provider: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          provider?: string
        }
        Relationships: []
      }
      slots: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          start_time: string
          status: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          start_time: string
          status?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          start_time?: string
          status?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "tech_runsheet"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "slots_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_documents: {
        Row: {
          active: boolean
          body: string
          category: string | null
          created_at: string
          id: string
          title: string
          version: number
        }
        Insert: {
          active?: boolean
          body: string
          category?: string | null
          created_at?: string
          id?: string
          title: string
          version?: number
        }
        Update: {
          active?: boolean
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          auth_user_id: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          role: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
        }
        Relationships: []
      }
      surveys: {
        Row: {
          appointment_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
        }
        Insert: {
          appointment_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
        }
        Update: {
          appointment_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "surveys_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "tech_runsheet"
            referencedColumns: ["appointment_id"]
          },
        ]
      }
      tech_house_assignments: {
        Row: {
          active: boolean
          created_at: string
          house_id: string
          id: string
          tech_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          house_id: string
          id?: string
          tech_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          house_id?: string
          id?: string
          tech_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_house_assignments_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_house_assignments_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "techs"
            referencedColumns: ["id"]
          },
        ]
      }
      techs: {
        Row: {
          auth_user_id: string | null
          base_rate_cents: number
          created_at: string
          deferred_rate_cents: number
          email: string
          first_name: string
          hired_at: string | null
          id: string
          last_name: string
          offboarded_at: string | null
          phone: string
          semester_number: number
          status: string
        }
        Insert: {
          auth_user_id?: string | null
          base_rate_cents?: number
          created_at?: string
          deferred_rate_cents?: number
          email: string
          first_name: string
          hired_at?: string | null
          id?: string
          last_name: string
          offboarded_at?: string | null
          phone: string
          semester_number?: number
          status?: string
        }
        Update: {
          auth_user_id?: string | null
          base_rate_cents?: number
          created_at?: string
          deferred_rate_cents?: number
          email?: string
          first_name?: string
          hired_at?: string | null
          id?: string
          last_name?: string
          offboarded_at?: string | null
          phone?: string
          semester_number?: number
          status?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string
          date: string
          house_id: string
          id: string
          status: string
          tech_id: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          date: string
          house_id: string
          id?: string
          status?: string
          tech_id?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string
          date?: string
          house_id?: string
          id?: string
          status?: string
          tech_id?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "techs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tech_runsheet: {
        Row: {
          access_notes: string | null
          address: string | null
          appointment_id: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          date: string | null
          duration_minutes: number | null
          house_name: string | null
          member_display_name: string | null
          room: string | null
          service_notes: string | null
          shade_preference: string | null
          start_time: string | null
          status: string | null
          visit_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_tech_id: { Args: never; Returns: string }
      tech_today_house_ids: { Args: never; Returns: string[] }
      tech_today_member_ids: { Args: never; Returns: string[] }
      tech_today_slot_ids: { Args: never; Returns: string[] }
      tech_today_visit_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
