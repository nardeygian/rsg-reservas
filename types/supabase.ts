export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          person_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          person_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          person_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_invitations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      account_provider_tokens: {
        Row: {
          provider: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          provider: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          provider?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      areas: {
        Row: {
          created_at: string
          id: string
          ministry_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          ministry_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          ministry_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          area_id: string | null
          assigned_by: string | null
          created_at: string
          decline_reason: string | null
          id: string
          meeting_id: string
          ministry_id: string
          person_id: string
          position_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          assigned_by?: string | null
          created_at?: string
          decline_reason?: string | null
          id?: string
          meeting_id: string
          ministry_id: string
          person_id: string
          position_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          assigned_by?: string | null
          created_at?: string
          decline_reason?: string | null
          id?: string
          meeting_id?: string
          ministry_id?: string
          person_id?: string
          position_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "assignments_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          assignment_id: string | null
          confirmed_at: string
          confirmed_by: string | null
          id: string
          meeting_id: string
          note: string | null
          person_id: string
          roles: string[]
          source: string
          status: string
        }
        Insert: {
          assignment_id?: string | null
          confirmed_at?: string
          confirmed_by?: string | null
          id?: string
          meeting_id: string
          note?: string | null
          person_id: string
          roles?: string[]
          source?: string
          status: string
        }
        Update: {
          assignment_id?: string | null
          confirmed_at?: string
          confirmed_by?: string | null
          id?: string
          meeting_id?: string
          note?: string | null
          person_id?: string
          roles?: string[]
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          person_id: string
          reason: string | null
          starts_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          person_id: string
          reason?: string | null
          starts_on: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          person_id?: string
          reason?: string | null
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
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
          {
            foreignKeyName: "booking_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "busy_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          booking_id: string
          item_id: string
          quantity: number
          unit_price_cents_snapshot: number
        }
        Insert: {
          booking_id: string
          item_id: string
          quantity: number
          unit_price_cents_snapshot: number
        }
        Update: {
          booking_id?: string
          item_id?: string
          quantity?: number
          unit_price_cents_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "busy_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "rentable_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_token: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          expected_attendance: number | null
          id: string
          internal_notes: string | null
          is_external: boolean
          is_recurrence_template: boolean
          meeting_id: string | null
          ministry_id: string | null
          montaje_lock: boolean
          owner_org_id: string
          parent_booking_id: string | null
          payment_marked_by: string | null
          payment_receipt_url: string | null
          payment_status: string
          recurrence_rule: string | null
          requirements: Json
          setup_minutes: number | null
          shared_occupancy_allowed: boolean
          space_id: string
          starts_at: string
          status: string
          teardown_minutes: number | null
          time_range: unknown
          title: string | null
          total_cents: number | null
          updated_at: string
          use_type: string
          visibility: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          expected_attendance?: number | null
          id?: string
          internal_notes?: string | null
          is_external?: boolean
          is_recurrence_template?: boolean
          meeting_id?: string | null
          ministry_id?: string | null
          montaje_lock?: boolean
          owner_org_id: string
          parent_booking_id?: string | null
          payment_marked_by?: string | null
          payment_receipt_url?: string | null
          payment_status?: string
          recurrence_rule?: string | null
          requirements?: Json
          setup_minutes?: number | null
          shared_occupancy_allowed?: boolean
          space_id: string
          starts_at: string
          status?: string
          teardown_minutes?: number | null
          time_range?: unknown
          title?: string | null
          total_cents?: number | null
          updated_at?: string
          use_type: string
          visibility?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          expected_attendance?: number | null
          id?: string
          internal_notes?: string | null
          is_external?: boolean
          is_recurrence_template?: boolean
          meeting_id?: string | null
          ministry_id?: string | null
          montaje_lock?: boolean
          owner_org_id?: string
          parent_booking_id?: string | null
          payment_marked_by?: string | null
          payment_receipt_url?: string | null
          payment_status?: string
          recurrence_rule?: string | null
          requirements?: Json
          setup_minutes?: number | null
          shared_occupancy_allowed?: boolean
          space_id?: string
          starts_at?: string
          status?: string
          teardown_minutes?: number | null
          time_range?: unknown
          title?: string | null
          total_cents?: number | null
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
            foreignKeyName: "bookings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["meeting_id"]
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
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "busy_slots"
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
      broadcasts: {
        Row: {
          audience: string
          author_id: string | null
          body: string
          created_at: string
          id: string
          link: string | null
          recipients_count: number | null
          scheduled_for: string
          scope_id: string | null
          sent_at: string | null
          title: string
        }
        Insert: {
          audience: string
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          link?: string | null
          recipients_count?: number | null
          scheduled_for?: string
          scope_id?: string | null
          sent_at?: string | null
          title: string
        }
        Update: {
          audience?: string
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          recipients_count?: number | null
          scheduled_for?: string
          scope_id?: string | null
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_links: {
        Row: {
          asana_gid: string
          booking_id: string
          created_at: string
          id: string
        }
        Insert: {
          asana_gid: string
          booking_id: string
          created_at?: string
          id?: string
        }
        Update: {
          asana_gid?: string
          booking_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "busy_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          assignment_id: string
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          moment: string
          sort: number
          text: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          moment: string
          sort?: number
          text: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          moment?: string
          sort?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          id: string
          moment: string
          position_id: string
          run_item_kind: string | null
          sort: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          moment: string
          position_id: string
          run_item_kind?: string | null
          sort?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          moment?: string
          position_id?: string
          run_item_kind?: string | null
          sort?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      discipleship_groups: {
        Row: {
          active: boolean
          created_at: string
          id: string
          leader_user_ids: string[]
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id: string
          leader_user_ids?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          leader_user_ids?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      donaciones_data: {
        Row: {
          donaciones: Json
          id: string
          updated_at: string
        }
        Insert: {
          donaciones?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          donaciones?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_changes: {
        Row: {
          actor_id: string | null
          change: string
          created_at: string
          id: string
          meeting_id: string
          new_date: string | null
          new_starts_at: string | null
          previous_date: string | null
          previous_starts_at: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          change: string
          created_at?: string
          id?: string
          meeting_id: string
          new_date?: string | null
          new_starts_at?: string | null
          previous_date?: string | null
          previous_starts_at?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          change?: string
          created_at?: string
          id?: string
          meeting_id?: string
          new_date?: string | null
          new_starts_at?: string | null
          previous_date?: string | null
          previous_starts_at?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_changes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_changes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_changes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["meeting_id"]
          },
        ]
      }
      meeting_spaces: {
        Row: {
          created_at: string
          meeting_id: string
          space_id: string
        }
        Insert: {
          created_at?: string
          meeting_id: string
          space_id: string
        }
        Update: {
          created_at?: string
          meeting_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_spaces_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_spaces_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "meeting_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_templates: {
        Row: {
          checklist_extra: Json
          created_at: string
          created_by: string | null
          created_from_meeting_id: string | null
          id: string
          meeting_type_id: string | null
          name: string
          required_positions: Json
          run_sheet: Json
          setup_minutes: number | null
          space_ids: string[] | null
          teardown_minutes: number | null
          updated_at: string
          version: number
        }
        Insert: {
          checklist_extra?: Json
          created_at?: string
          created_by?: string | null
          created_from_meeting_id?: string | null
          id?: string
          meeting_type_id?: string | null
          name: string
          required_positions?: Json
          run_sheet?: Json
          setup_minutes?: number | null
          space_ids?: string[] | null
          teardown_minutes?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          checklist_extra?: Json
          created_at?: string
          created_by?: string | null
          created_from_meeting_id?: string | null
          id?: string
          meeting_type_id?: string | null
          name?: string
          required_positions?: Json
          run_sheet?: Json
          setup_minutes?: number | null
          space_ids?: string[] | null
          teardown_minutes?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_templates_created_from_fkey"
            columns: ["created_from_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_templates_created_from_fkey"
            columns: ["created_from_meeting_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "meeting_templates_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_types: {
        Row: {
          active: boolean
          asana_rules: Json
          color: string | null
          counting: string
          created_at: string
          default_template_id: string | null
          duration_min: number | null
          id: string
          kind: string
          ministry_id: string | null
          name: string
          setup_minutes: number
          sort: number
          teardown_minutes: number
          updated_at: string
          usual_space_id: string | null
          usual_space_ids: string[]
          usual_time: string | null
          usual_weekday: number | null
        }
        Insert: {
          active?: boolean
          asana_rules?: Json
          color?: string | null
          counting?: string
          created_at?: string
          default_template_id?: string | null
          duration_min?: number | null
          id?: string
          kind?: string
          ministry_id?: string | null
          name: string
          setup_minutes?: number
          sort?: number
          teardown_minutes?: number
          updated_at?: string
          usual_space_id?: string | null
          usual_space_ids?: string[]
          usual_time?: string | null
          usual_weekday?: number | null
        }
        Update: {
          active?: boolean
          asana_rules?: Json
          color?: string | null
          counting?: string
          created_at?: string
          default_template_id?: string | null
          duration_min?: number | null
          id?: string
          kind?: string
          ministry_id?: string | null
          name?: string
          setup_minutes?: number
          sort?: number
          teardown_minutes?: number
          updated_at?: string
          usual_space_id?: string | null
          usual_space_ids?: string[]
          usual_time?: string | null
          usual_weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_types_default_template_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "meeting_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_types_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_types_usual_space_id_fkey"
            columns: ["usual_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          asana_gid: string | null
          attendance_closed_at: string | null
          attendance_closed_by: string | null
          booking_id: string | null
          created_at: string
          created_by: string | null
          current_item_id: string | null
          ends_at: string | null
          id: string
          kind: string
          legacy_id: string | null
          meeting_date: string
          meeting_type_id: string | null
          ministry_id: string | null
          name: string
          notes: string | null
          origin: string
          outside_asana: boolean
          section: string | null
          setup_minutes: number
          starts_at: string | null
          status: string
          teardown_minutes: number
          template_id: string | null
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          asana_gid?: string | null
          attendance_closed_at?: string | null
          attendance_closed_by?: string | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          current_item_id?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          legacy_id?: string | null
          meeting_date: string
          meeting_type_id?: string | null
          ministry_id?: string | null
          name: string
          notes?: string | null
          origin?: string
          outside_asana?: boolean
          section?: string | null
          setup_minutes?: number
          starts_at?: string | null
          status?: string
          teardown_minutes?: number
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          asana_gid?: string | null
          attendance_closed_at?: string | null
          attendance_closed_by?: string | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          current_item_id?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          legacy_id?: string | null
          meeting_date?: string
          meeting_type_id?: string | null
          ministry_id?: string | null
          name?: string
          notes?: string | null
          origin?: string
          outside_asana?: boolean
          section?: string | null
          setup_minutes?: number
          starts_at?: string | null
          status?: string
          teardown_minutes?: number
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_attendance_closed_by_fkey"
            columns: ["attendance_closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_calendar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "busy_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_current_item_fkey"
            columns: ["current_item_id"]
            isOneToOne: false
            referencedRelation: "run_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "meeting_templates"
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
      notifications: {
        Row: {
          body: string | null
          broadcast_id: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          pushed_at: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          broadcast_id?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          broadcast_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
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
      people: {
        Row: {
          active: boolean
          created_at: string
          discipleship_group_id: string | null
          email: string | null
          full_name: string
          id: string
          legacy_disciple_id: string | null
          legacy_servant_id: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          discipleship_group_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          legacy_disciple_id?: string | null
          legacy_servant_id?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          discipleship_group_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          legacy_disciple_id?: string | null
          legacy_servant_id?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_discipleship_group_id_fkey"
            columns: ["discipleship_group_id"]
            isOneToOne: false
            referencedRelation: "discipleship_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          permission: string | null
          role: string | null
          scope_id: string | null
          scope_type: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          permission?: string | null
          role?: string | null
          scope_id?: string | null
          scope_type?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          permission?: string | null
          role?: string | null
          scope_id?: string | null
          scope_type?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      person_positions: {
        Row: {
          person_id: string
          position_id: string
        }
        Insert: {
          person_id: string
          position_id: string
        }
        Update: {
          person_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_positions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          active: boolean
          area_id: string | null
          created_at: string
          description: string | null
          id: string
          ministry_id: string
          name: string
          sort: number
        }
        Insert: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ministry_id: string
          name: string
          sort?: number
        }
        Update: {
          active?: boolean
          area_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ministry_id?: string
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "positions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calendar_feed_token: string
          created_at: string
          full_name: string
          id: string
          ministry_id: string | null
          panel_url: string | null
          requested_role: string | null
          role: string
          slack_user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          calendar_feed_token?: string
          created_at?: string
          full_name: string
          id: string
          ministry_id?: string | null
          panel_url?: string | null
          requested_role?: string | null
          role?: string
          slack_user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          calendar_feed_token?: string
          created_at?: string
          full_name?: string
          id?: string
          ministry_id?: string | null
          panel_url?: string | null
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
      push_subscriptions: {
        Row: {
          app_version: string | null
          auth: string | null
          created_at: string
          device: string | null
          endpoint: string | null
          id: string
          last_seen_at: string
          p256dh: string | null
          platform: string
          token: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          auth?: string | null
          created_at?: string
          device?: string | null
          endpoint?: string | null
          id?: string
          last_seen_at?: string
          p256dh?: string | null
          platform: string
          token?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          auth?: string | null
          created_at?: string
          device?: string | null
          endpoint?: string | null
          id?: string
          last_seen_at?: string
          p256dh?: string | null
          platform?: string
          token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          assignment_id: string
          id: string
          kind: string
          send_at: string
          sent_at: string | null
        }
        Insert: {
          assignment_id: string
          id?: string
          kind: string
          send_at: string
          sent_at?: string | null
        }
        Update: {
          assignment_id?: string
          id?: string
          kind?: string
          send_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      rentable_items: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          total_quantity: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          total_quantity: number
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          total_quantity?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: string
          role: string
        }
        Insert: {
          permission: string
          role: string
        }
        Update: {
          permission?: string
          role?: string
        }
        Relationships: []
      }
      run_items: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          duration_sec: number
          id: string
          kind: string
          meeting_id: string
          notes: string | null
          responsible_position_id: string | null
          song_id: string | null
          song_key: string | null
          sort: number
          title: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          duration_sec?: number
          id?: string
          kind?: string
          meeting_id: string
          notes?: string | null
          responsible_position_id?: string | null
          song_id?: string | null
          song_key?: string | null
          sort: number
          title: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          duration_sec?: number
          id?: string
          kind?: string
          meeting_id?: string
          notes?: string | null
          responsible_position_id?: string | null
          song_id?: string | null
          song_key?: string | null
          sort?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "service_units"
            referencedColumns: ["meeting_id"]
          },
          {
            foreignKeyName: "run_items_responsible_position_id_fkey"
            columns: ["responsible_position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_items_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      servicio_data: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      servir_ajustes: {
        Row: {
          alejandose_hasta: number
          id: boolean
          inactivo_semanas: number
          sobrecargado_desde: number
          updated_at: string
          updated_by: string | null
          ventana_dias: number
        }
        Insert: {
          alejandose_hasta?: number
          id?: boolean
          inactivo_semanas?: number
          sobrecargado_desde?: number
          updated_at?: string
          updated_by?: string | null
          ventana_dias?: number
        }
        Update: {
          alejandose_hasta?: number
          id?: boolean
          inactivo_semanas?: number
          sobrecargado_desde?: number
          updated_at?: string
          updated_by?: string | null
          ventana_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "servir_ajustes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          active: boolean
          artist: string | null
          bpm: number | null
          ccli: string | null
          created_at: string
          created_by: string | null
          default_key: string | null
          files: Json
          id: string
          last_used_on: string | null
          lyrics: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          artist?: string | null
          bpm?: number | null
          ccli?: string | null
          created_at?: string
          created_by?: string | null
          default_key?: string | null
          files?: Json
          id?: string
          last_used_on?: string | null
          lyrics?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          artist?: string | null
          bpm?: number | null
          ccli?: string | null
          created_at?: string
          created_by?: string | null
          default_key?: string | null
          files?: Json
          id?: string
          last_used_on?: string | null
          lyrics?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          hourly_rate_cents: number | null
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
          hourly_rate_cents?: number | null
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
          hourly_rate_cents?: number | null
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
      team_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          full_name: string
          id: string
          message: string | null
          ministry_id: string
          person_id: string | null
          profile_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          full_name: string
          id?: string
          message?: string | null
          ministry_id: string
          person_id?: string | null
          profile_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          full_name?: string
          id?: string
          message?: string | null
          ministry_id?: string
          person_id?: string | null
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_join_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          area_id: string | null
          id: string
          joined_at: string
          ministry_id: string
          person_id: string
        }
        Insert: {
          active?: boolean
          area_id?: string | null
          id?: string
          joined_at?: string
          ministry_id: string
          person_id: string
        }
        Update: {
          active?: boolean
          area_id?: string | null
          id?: string
          joined_at?: string
          ministry_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          effect: string
          granted_by: string | null
          id: string
          permission: string
          scope_id: string | null
          scope_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          effect: string
          granted_by?: string | null
          id?: string
          permission: string
          scope_id?: string | null
          scope_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          effect?: string
          granted_by?: string | null
          id?: string
          permission?: string
          scope_id?: string | null
          scope_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          area_id: string | null
          created_at: string
          id: string
          ministry_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          id?: string
          ministry_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          id?: string
          ministry_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          occupied_from: string | null
          occupied_until: string | null
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
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "busy_slots"
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
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_token: string | null
          created_at: string | null
          created_by: string | null
          ends_at: string | null
          expected_attendance: number | null
          id: string | null
          internal_notes: string | null
          is_external: boolean | null
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
          total_cents: number | null
          updated_at: string | null
          use_type: string | null
          visibility: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          expected_attendance?: number | null
          id?: string | null
          internal_notes?: string | null
          is_external?: boolean | null
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
          total_cents?: number | null
          updated_at?: string | null
          use_type?: string | null
          visibility?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_token?: string | null
          created_at?: string | null
          created_by?: string | null
          ends_at?: string | null
          expected_attendance?: number | null
          id?: string | null
          internal_notes?: string | null
          is_external?: boolean | null
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
          total_cents?: number | null
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
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "busy_slots"
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
      busy_slots: {
        Row: {
          ends_at: string | null
          id: string | null
          space_id: string | null
          starts_at: string | null
        }
        Insert: {
          ends_at?: string | null
          id?: string | null
          space_id?: string | null
          starts_at?: string | null
        }
        Update: {
          ends_at?: string | null
          id?: string | null
          space_id?: string | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      salud_servidor_mensual: {
        Row: {
          aceptadas: number | null
          asignaciones: number | null
          ausencias: number | null
          checklist_hechos: number | null
          checklist_total: number | null
          horas_respuesta: number | null
          mes: string | null
          min: number | null
          pendientes: number | null
          person_id: string | null
          rechazadas: number | null
          serv: number | null
          servicios: number | null
          tardes: number | null
          ultima_fecha: string | null
        }
        Relationships: []
      }
      service_units: {
        Row: {
          counting: string | null
          meeting_date: string | null
          meeting_id: string | null
          meeting_type_id: string | null
          person_id: string | null
          unit_key: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_meeting_type_id_fkey"
            columns: ["meeting_type_id"]
            isOneToOne: false
            referencedRelation: "meeting_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aceptar_invitacion: { Args: { p_token: string }; Returns: string }
      asistencia_sugerida: {
        Args: { p_meeting_id: string }
        Returns: {
          assignment_status: string
          checklist_done: number
          checklist_total: number
          current_note: string
          current_status: string
          full_name: string
          ministries: string[]
          person_id: string
          roles: string[]
          suggested: string
        }[]
      }
      avanzar_item: {
        Args: { p_item_id: string; p_meeting_id: string }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          asana_gid: string | null
          attendance_closed_at: string | null
          attendance_closed_by: string | null
          booking_id: string | null
          created_at: string
          created_by: string | null
          current_item_id: string | null
          ends_at: string | null
          id: string
          kind: string
          legacy_id: string | null
          meeting_date: string
          meeting_type_id: string | null
          ministry_id: string | null
          name: string
          notes: string | null
          origin: string
          outside_asana: boolean
          section: string | null
          setup_minutes: number
          starts_at: string | null
          status: string
          teardown_minutes: number
          template_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      avisar_reserva_reunion: {
        Args: {
          b: Database["public"]["Tables"]["bookings"]["Row"]
          m: Database["public"]["Tables"]["meetings"]["Row"]
        }
        Returns: undefined
      }
      broadcast_recipients: {
        Args: { p_audience: string; p_scope_id: string }
        Returns: string[]
      }
      can_approve_join: { Args: { p_ministry_id: string }; Returns: boolean }
      can_assign: {
        Args: { p_area_id: string; p_ministry_id: string }
        Returns: boolean
      }
      can_confirm_attendance: {
        Args: { p_meeting_id: string; p_person_id: string }
        Returns: boolean
      }
      can_invite_person: { Args: { p_person_id: string }; Returns: boolean }
      can_see_meeting: { Args: { p_meeting_id: string }; Returns: boolean }
      can_see_person_stats: { Args: { p_person_id: string }; Returns: boolean }
      cancelar_solicitud: { Args: { p_request_id: string }; Returns: undefined }
      confirmar_asistencia: {
        Args: { p_cerrar?: boolean; p_filas: Json; p_meeting_id: string }
        Returns: number
      }
      crear_invitacion: {
        Args: { p_email?: string; p_person_id: string }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      cuenta_bloqueos_eliminacion: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      cuenta_resumen_eliminacion: {
        Args: { p_user_id: string }
        Returns: {
          ministerios_que_lidera: number
          reservas: number
          reservas_futuras: number
        }[]
      }
      current_person_id: { Args: never; Returns: string }
      current_role_is: { Args: { roles: string[] }; Returns: boolean }
      disponibilidad_espacios: {
        Args: {
          p_ends: string
          p_meeting_id?: string
          p_setup_minutes?: number
          p_starts: string
          p_teardown_minutes?: number
        }
        Returns: {
          booking_policy: string
          capacity: number
          libre: boolean
          name: string
          ocupado_desde: string
          ocupado_hasta: string
          space_id: string
        }[]
      }
      eliminar_datos_personales: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      estadisticas_reuniones: {
        Args: {
          p_desde: string
          p_hasta: string
          p_meeting_type_id?: string
          p_ministry_id?: string
        }
        Returns: {
          aceptadas: number
          asignadas: number
          asistio: number
          ausente: number
          checklist_hechos: number
          checklist_total: number
          color: string
          duracion_plan_seg: number
          duracion_real_seg: number
          horas_respuesta: number
          meeting_date: string
          meeting_id: string
          meeting_type_id: string
          motivo_cancelacion: string
          name: string
          pendientes: number
          rechazadas: number
          reprogramaciones: number
          requeridas: number
          status: string
          tarde: number
          tipo: string
        }[]
      }
      ficha_servidor: { Args: { p_person_id: string }; Returns: Json }
      franja_bogota: {
        Args: { p_desde: string; p_hasta: string }
        Returns: string
      }
      has_global_permission: {
        Args: { p_permission: string }
        Returns: boolean
      }
      has_permission: {
        Args: {
          p_permission: string
          p_scope_id?: string
          p_scope_type?: string
        }
        Returns: boolean
      }
      iniciar_reunion: {
        Args: { p_meeting_id: string }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          asana_gid: string | null
          attendance_closed_at: string | null
          attendance_closed_by: string | null
          booking_id: string | null
          created_at: string
          created_by: string | null
          current_item_id: string | null
          ends_at: string | null
          id: string
          kind: string
          legacy_id: string | null
          meeting_date: string
          meeting_type_id: string | null
          ministry_id: string | null
          name: string
          notes: string | null
          origin: string
          outside_asana: boolean
          section: string | null
          setup_minutes: number
          starts_at: string | null
          status: string
          teardown_minutes: number
          template_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      invitation_token_hash: { Args: { p_token: string }; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      items_available: {
        Args: { _ends: string; _exclude_booking?: string; _starts: string }
        Returns: {
          available: number
          item_id: string
          name: string
        }[]
      }
      meeting_start: {
        Args: { m: Database["public"]["Tables"]["meetings"]["Row"] }
        Returns: string
      }
      my_broadcast_audiences: {
        Args: never
        Returns: {
          audience: string
          label: string
          scope_id: string
        }[]
      }
      my_role_scopes: {
        Args: never
        Returns: {
          role: string
          scope_id: string
          scope_type: string
        }[]
      }
      notif_cuando: { Args: { p_ts: string }; Returns: string }
      notificador_disparar: { Args: never; Returns: number }
      notificador_por_enviar: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          id: string
          kind: string
          link: string
          title: string
          user_id: string
        }[]
      }
      notificador_procesar: { Args: never; Returns: Json }
      permission_scopes: {
        Args: { p_permission: string }
        Returns: {
          scope_id: string
          scope_type: string
        }[]
      }
      promote_user_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
      puede_ver_estadisticas: { Args: never; Returns: boolean }
      refrescar_salud_servidor: { Args: never; Returns: undefined }
      refresh_song_last_used: {
        Args: { p_song_ids: string[] }
        Returns: undefined
      }
      register_push_device: {
        Args: {
          p_app_version?: string
          p_auth?: string
          p_device?: string
          p_endpoint?: string
          p_p256dh?: string
          p_platform: string
          p_token?: string
        }
        Returns: string
      }
      respond_assignment: {
        Args: { p_accept: boolean; p_assignment_id: string; p_reason?: string }
        Returns: {
          area_id: string | null
          assigned_by: string | null
          created_at: string
          decline_reason: string | null
          id: string
          meeting_id: string
          ministry_id: string
          person_id: string
          position_id: string
          responded_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      responder_solicitud: {
        Args: { p_aprobar: boolean; p_nota?: string; p_request_id: string }
        Returns: string
      }
      revocar_invitacion: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      salud_mensual: {
        Args: { p_meses?: number; p_person_id?: string }
        Returns: {
          aceptadas: number | null
          asignaciones: number | null
          ausencias: number | null
          checklist_hechos: number | null
          checklist_total: number | null
          horas_respuesta: number | null
          mes: string | null
          min: number | null
          pendientes: number | null
          person_id: string | null
          rechazadas: number | null
          serv: number | null
          servicios: number | null
          tardes: number | null
          ultima_fecha: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "salud_servidor_mensual"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      salud_servidores: {
        Args: { p_ministry_id?: string }
        Returns: {
          ausencias_ventana: number
          departamentos: string[]
          full_name: string
          min_ventana: number
          person_id: string
          promedio_3m: number
          racha_semanas: number
          rechazos_60: number
          respuestas_60: number
          semaforo: string
          serv_ventana: number
          servicios_ventana: number
          tardes_ventana: number
          ultima_fecha: string
        }[]
      }
      sincronizar_reservas_reunion: {
        Args: { p_meeting_id: string }
        Returns: undefined
      }
      solicitar_unirse: {
        Args: { p_message?: string; p_ministry_id: string }
        Returns: string
      }
      terminar_reunion: {
        Args: { p_meeting_id: string }
        Returns: {
          actual_end: string | null
          actual_start: string | null
          asana_gid: string | null
          attendance_closed_at: string | null
          attendance_closed_by: string | null
          booking_id: string | null
          created_at: string
          created_by: string | null
          current_item_id: string | null
          ends_at: string | null
          id: string
          kind: string
          legacy_id: string | null
          meeting_date: string
          meeting_type_id: string | null
          ministry_id: string | null
          name: string
          notes: string | null
          origin: string
          outside_asana: boolean
          section: string | null
          setup_minutes: number
          starts_at: string | null
          status: string
          teardown_minutes: number
          template_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      toggle_checklist_item: {
        Args: { p_done: boolean; p_item_id: string }
        Returns: {
          assignment_id: string
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          moment: string
          sort: number
          text: string
        }
        SetofOptions: {
          from: "*"
          to: "checklist_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ver_invitacion: {
        Args: { p_token: string }
        Returns: {
          es_mia: boolean
          expires_at: string
          first_name: string
          invited_by_name: string
          status: string
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

