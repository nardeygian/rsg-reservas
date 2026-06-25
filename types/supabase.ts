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
      booking_audit: {
        Row: {
          action: string
          actor_id: string | null
          booking_id: string
          changes: Json | null
          created_at: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          booking_id: string
          changes?: Json | null
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          booking_id?: string
          changes?: Json | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          expected_attendance: number | null
          id: string
          internal_notes: string | null
          is_recurrence_template: boolean
          ministry_id: string | null
          montaje_lock: boolean
          owner_org_id: string
          parent_booking_id: string | null
          payment_marked_by: string | null
          payment_receipt_url: string | null
          payment_status: string
          recurrence_rule: string | null
          requirements: Json
          shared_occupancy_allowed: boolean
          space_id: string
          starts_at: string
          status: string
          time_range: unknown
          title: string | null
          updated_at: string
          use_type: string
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          expected_attendance?: number | null
          id?: string
          internal_notes?: string | null
          is_recurrence_template?: boolean
          ministry_id?: string | null
          montaje_lock?: boolean
          owner_org_id: string
          parent_booking_id?: string | null
          payment_marked_by?: string | null
          payment_receipt_url?: string | null
          payment_status?: string
          recurrence_rule?: string | null
          requirements?: Json
          shared_occupancy_allowed?: boolean
          space_id: string
          starts_at: string
          status?: string
          time_range?: unknown
          title?: string | null
          updated_at?: string
          use_type: string
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          expected_attendance?: number | null
          id?: string
          internal_notes?: string | null
          is_recurrence_template?: boolean
          ministry_id?: string | null
          montaje_lock?: boolean
          owner_org_id?: string
          parent_booking_id?: string | null
          payment_marked_by?: string | null
          payment_receipt_url?: string | null
          payment_status?: string
          recurrence_rule?: string | null
          requirements?: Json
          shared_occupancy_allowed?: boolean
          space_id?: string
          starts_at?: string
          status?: string
          time_range?: unknown
          title?: string | null
          updated_at?: string
          use_type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_marked_by_fkey"
            columns: ["payment_marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          created_at: string
          id: string
          lead_user_id: string | null
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministries_lead_user_id_fkey"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          calendar_feed_token: string
          created_at: string
          full_name: string
          id: string
          ministry_id: string | null
          requested_role: string | null
          role: string
          slack_user_id: string | null
        }
        Insert: {
          calendar_feed_token?: string
          created_at?: string
          full_name: string
          id: string
          ministry_id?: string | null
          requested_role?: string | null
          role?: string
          slack_user_id?: string | null
        }
        Update: {
          calendar_feed_token?: string
          created_at?: string
          full_name?: string
          id?: string
          ministry_id?: string | null
          requested_role?: string | null
          role?: string
          slack_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          allows_shared_occupancy: boolean
          booking_policy: string
          capacity: number | null
          created_at: string
          id: string
          managed_by_org_id: string | null
          name: string
          notes: string | null
          setup_buffer_minutes: number
          slug: string
          status: string
          teardown_buffer_minutes: number
        }
        Insert: {
          allows_shared_occupancy?: boolean
          booking_policy?: string
          capacity?: number | null
          created_at?: string
          id?: string
          managed_by_org_id?: string | null
          name: string
          notes?: string | null
          setup_buffer_minutes?: number
          slug: string
          status?: string
          teardown_buffer_minutes?: number
        }
        Update: {
          allows_shared_occupancy?: boolean
          booking_policy?: string
          capacity?: number | null
          created_at?: string
          id?: string
          managed_by_org_id?: string | null
          name?: string
          notes?: string | null
          setup_buffer_minutes?: number
          slug?: string
          status?: string
          teardown_buffer_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "spaces_managed_by_org_id_fkey"
            columns: ["managed_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bookings_calendar: {
        Row: {
          created_by: string | null
          display_owner: string | null
          ends_at: string | null
          has_montaje_lock: boolean | null
          id: string | null
          parent_booking_id: string | null
          space_id: string | null
          space_name: string | null
          starts_at: string | null
          status: string | null
          title: string | null
          use_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings_staff: {
        Row: {
          created_at: string | null
          created_by: string | null
          ends_at: string | null
          expected_attendance: number | null
          id: string | null
          internal_notes: string | null
          is_recurrence_template: boolean | null
          ministry_id: string | null
          montaje_lock: boolean | null
          owner_org_id: string | null
          parent_booking_id: string | null
          payment_marked_by: string | null
          payment_receipt_url: string | null
          payment_status: string | null
          recurrence_rule: string | null
          requirements: Json | null
          shared_occupancy_allowed: boolean | null
          space_id: string | null
          starts_at: string | null
          status: string | null
          time_range: unknown
          title: string | null
          updated_at: string | null
          use_type: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          expected_attendance?: number | null
          id?: string | null
          internal_notes?: string | null
          is_recurrence_template?: boolean | null
          ministry_id?: string | null
          montaje_lock?: boolean | null
          owner_org_id?: string | null
          parent_booking_id?: string | null
          payment_marked_by?: string | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          recurrence_rule?: string | null
          requirements?: Json | null
          shared_occupancy_allowed?: boolean | null
          space_id?: string | null
          starts_at?: string | null
          status?: string | null
          time_range?: unknown
          title?: string | null
          updated_at?: string | null
          use_type?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          expected_attendance?: number | null
          id?: string | null
          internal_notes?: string | null
          is_recurrence_template?: boolean | null
          ministry_id?: string | null
          montaje_lock?: boolean | null
          owner_org_id?: string | null
          parent_booking_id?: string | null
          payment_marked_by?: string | null
          payment_receipt_url?: string | null
          payment_status?: string | null
          recurrence_rule?: string | null
          requirements?: Json | null
          shared_occupancy_allowed?: boolean | null
          space_id?: string | null
          starts_at?: string | null
          status?: string | null
          time_range?: unknown
          title?: string | null
          updated_at?: string | null
          use_type?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_owner_org_id_fkey"
            columns: ["owner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_marked_by_fkey"
            columns: ["payment_marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_role_is: { Args: { roles: string[] }; Returns: boolean }
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
