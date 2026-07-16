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
      ai_transfer_log: {
        Row: {
          caller: string
          created_at: string
          field_count: number | null
          id: string
          minimization_level: string
          model: string
          payload_field_hashes: Json
          provider: string
          provider_region: string | null
          redacted_field_count: number | null
          request_bytes: number | null
          response_bytes: number | null
          status: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          caller: string
          created_at?: string
          field_count?: number | null
          id?: string
          minimization_level?: string
          model: string
          payload_field_hashes?: Json
          provider: string
          provider_region?: string | null
          redacted_field_count?: number | null
          request_bytes?: number | null
          response_bytes?: number | null
          status?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          caller?: string
          created_at?: string
          field_count?: number | null
          id?: string
          minimization_level?: string
          model?: string
          payload_field_hashes?: Json
          provider?: string
          provider_region?: string | null
          redacted_field_count?: number | null
          request_bytes?: number | null
          response_bytes?: number | null
          status?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_transfer_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      automated_messages: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string | null
          customer_id: string | null
          delivery_method: string
          error_message: string | null
          id: string
          message_type: string
          recipient_email: string | null
          recipient_phone: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivery_method: string
          error_message?: string | null
          id?: string
          message_type: string
          recipient_email?: string | null
          recipient_phone?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivery_method?: string
          error_message?: string | null
          id?: string
          message_type?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automated_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "automated_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "automated_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automated_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_dunning_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          from_stage: string | null
          id: string
          note: string | null
          team_id: string
          to_stage: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          team_id: string
          to_stage?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          note?: string | null
          team_id?: string
          to_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_dunning_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          balance_due: number | null
          booking_ref: string | null
          booking_source: string
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string | null
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          daily_rate: number
          delivery_address: string | null
          delivery_fee: number | null
          deposit_amount: number | null
          discount_amount: number | null
          discount_reason: string | null
          dropoff_location: string | null
          dropoff_location_id: string | null
          end_date: string
          gas_fee: number | null
          gas_fee_waived: boolean | null
          google_calendar_event_id: string | null
          id: string
          invoice_issued_at: string | null
          invoice_number: string | null
          mileage_limit: number | null
          mileage_overage_fee: number | null
          notes: string | null
          payment_status: string | null
          pickup_fuel_level: number | null
          pickup_location: string
          pickup_location_id: string | null
          pickup_odometer: number | null
          platform_fee_amount: number
          platform_fee_base: number
          platform_fee_percent_snapshot: number
          rental_duration_type: string | null
          requires_delivery: boolean | null
          return_fuel_level: number | null
          return_odometer: number | null
          security_deposit_amount: number | null
          security_deposit_status: string | null
          start_date: string
          status: string | null
          subtotal: number
          tax_amount: number
          tax_inclusive: boolean
          tax_rate_percent: number
          team_id: string | null
          total_value: number
          updated_at: string | null
          user_id: string
          vehicle_id: string | null
          vehicle_name: string | null
        }
        Insert: {
          balance_due?: number | null
          booking_ref?: string | null
          booking_source?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          daily_rate: number
          delivery_address?: string | null
          delivery_fee?: number | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_reason?: string | null
          dropoff_location?: string | null
          dropoff_location_id?: string | null
          end_date: string
          gas_fee?: number | null
          gas_fee_waived?: boolean | null
          google_calendar_event_id?: string | null
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          mileage_limit?: number | null
          mileage_overage_fee?: number | null
          notes?: string | null
          payment_status?: string | null
          pickup_fuel_level?: number | null
          pickup_location: string
          pickup_location_id?: string | null
          pickup_odometer?: number | null
          platform_fee_amount?: number
          platform_fee_base?: number
          platform_fee_percent_snapshot?: number
          rental_duration_type?: string | null
          requires_delivery?: boolean | null
          return_fuel_level?: number | null
          return_odometer?: number | null
          security_deposit_amount?: number | null
          security_deposit_status?: string | null
          start_date: string
          status?: string | null
          subtotal?: number
          tax_amount?: number
          tax_inclusive?: boolean
          tax_rate_percent?: number
          team_id?: string | null
          total_value: number
          updated_at?: string | null
          user_id: string
          vehicle_id?: string | null
          vehicle_name?: string | null
        }
        Update: {
          balance_due?: number | null
          booking_ref?: string | null
          booking_source?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          daily_rate?: number
          delivery_address?: string | null
          delivery_fee?: number | null
          deposit_amount?: number | null
          discount_amount?: number | null
          discount_reason?: string | null
          dropoff_location?: string | null
          dropoff_location_id?: string | null
          end_date?: string
          gas_fee?: number | null
          gas_fee_waived?: boolean | null
          google_calendar_event_id?: string | null
          id?: string
          invoice_issued_at?: string | null
          invoice_number?: string | null
          mileage_limit?: number | null
          mileage_overage_fee?: number | null
          notes?: string | null
          payment_status?: string | null
          pickup_fuel_level?: number | null
          pickup_location?: string
          pickup_location_id?: string | null
          pickup_odometer?: number | null
          platform_fee_amount?: number
          platform_fee_base?: number
          platform_fee_percent_snapshot?: number
          rental_duration_type?: string | null
          requires_delivery?: boolean | null
          return_fuel_level?: number | null
          return_odometer?: number | null
          security_deposit_amount?: number | null
          security_deposit_status?: string | null
          start_date?: string
          status?: string | null
          subtotal?: number
          tax_amount?: number
          tax_inclusive?: boolean
          tax_rate_percent?: number
          team_id?: string | null
          total_value?: number
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string | null
          vehicle_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_dropoff_location_id_fkey"
            columns: ["dropoff_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          notifications_enabled: boolean | null
          role: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          notifications_enabled?: boolean | null
          role?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          notifications_enabled?: boolean | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "team_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          booking_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          note: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "customer_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          blacklist_reason: string | null
          created_at: string | null
          customer_status: string | null
          date_of_birth: string | null
          drivers_license: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          id_document_url: string | null
          id_verified: boolean | null
          id_verified_at: string | null
          insurance_document_url: string | null
          insurance_expiry: string | null
          insurance_policy: string | null
          insurance_provider: string | null
          insurance_verified: boolean | null
          insurance_verified_at: string | null
          license_expiry: string | null
          lifetime_value: number | null
          notes: string | null
          phone: string | null
          preferences: Json | null
          secondary_phone: string | null
          stripe_customer_id: string | null
          tags: string[] | null
          team_id: string | null
          total_bookings: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          blacklist_reason?: string | null
          created_at?: string | null
          customer_status?: string | null
          date_of_birth?: string | null
          drivers_license?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          id_document_url?: string | null
          id_verified?: boolean | null
          id_verified_at?: string | null
          insurance_document_url?: string | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          insurance_provider?: string | null
          insurance_verified?: boolean | null
          insurance_verified_at?: string | null
          license_expiry?: string | null
          lifetime_value?: number | null
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          secondary_phone?: string | null
          stripe_customer_id?: string | null
          tags?: string[] | null
          team_id?: string | null
          total_bookings?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          blacklist_reason?: string | null
          created_at?: string | null
          customer_status?: string | null
          date_of_birth?: string | null
          drivers_license?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          id_document_url?: string | null
          id_verified?: boolean | null
          id_verified_at?: string | null
          insurance_document_url?: string | null
          insurance_expiry?: string | null
          insurance_policy?: string | null
          insurance_provider?: string | null
          insurance_verified?: boolean | null
          insurance_verified_at?: string | null
          license_expiry?: string | null
          lifetime_value?: number | null
          notes?: string | null
          phone?: string | null
          preferences?: Json | null
          secondary_phone?: string | null
          stripe_customer_id?: string | null
          tags?: string[] | null
          team_id?: string | null
          total_bookings?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_claims: {
        Row: {
          actual_cost: number | null
          booking_id: string | null
          claim_status: string | null
          claim_type: string
          created_at: string | null
          customer_id: string | null
          description: string
          estimated_cost: number | null
          id: string
          inspection_id: string | null
          insurance_claim_number: string | null
          photo_urls: string[] | null
          reported_date: string | null
          resolution_notes: string | null
          resolved_date: string | null
          severity: string
          team_id: string | null
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          actual_cost?: number | null
          booking_id?: string | null
          claim_status?: string | null
          claim_type: string
          created_at?: string | null
          customer_id?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          inspection_id?: string | null
          insurance_claim_number?: string | null
          photo_urls?: string[] | null
          reported_date?: string | null
          resolution_notes?: string | null
          resolved_date?: string | null
          severity: string
          team_id?: string | null
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          actual_cost?: number | null
          booking_id?: string | null
          claim_status?: string | null
          claim_type?: string
          created_at?: string | null
          customer_id?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          inspection_id?: string | null
          insurance_claim_number?: string | null
          photo_urls?: string[] | null
          reported_date?: string | null
          resolution_notes?: string | null
          resolved_date?: string | null
          severity?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_claims_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "damage_claims_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_claims_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "damage_claims_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_claims_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_claims_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damage_claims_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          entity: string
          id: string
          metadata: Json
          record_id: string | null
          team_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity: string
          id?: string
          metadata?: Json
          record_id?: string | null
          team_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity?: string
          id?: string
          metadata?: Json
          record_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_access_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      data_backups: {
        Row: {
          backup_name: string
          backup_type: string
          created_at: string | null
          file_size_bytes: number | null
          id: string
          status: string
          storage_path: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          backup_name: string
          backup_type: string
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string
          storage_path?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          backup_name?: string
          backup_type?: string
          created_at?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string
          storage_path?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_backups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      data_processing_inventory: {
        Row: {
          category: string
          created_at: string
          description: string | null
          entity: string
          field: string
          id: string
          lawful_basis: string
          never_transfer: boolean
          notes: string | null
          region_partitionable: boolean
          retention_days: number | null
          sub_processor_names: string[]
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          entity: string
          field: string
          id?: string
          lawful_basis: string
          never_transfer?: boolean
          notes?: string | null
          region_partitionable?: boolean
          retention_days?: number | null
          sub_processor_names?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          entity?: string
          field?: string
          id?: string
          lawful_basis?: string
          never_transfer?: boolean
          notes?: string | null
          region_partitionable?: boolean
          retention_days?: number | null
          sub_processor_names?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          created_at: string
          evidence_url: string | null
          executed_at: string | null
          export_expires_at: string | null
          export_url: string | null
          fulfilled_at: string | null
          id: string
          notes: string | null
          preview_counts: Json | null
          receipt_id: string | null
          request_type: string
          requester_email: string | null
          requester_user_id: string | null
          scheduled_purge_at: string | null
          status: string
          subject_customer_id: string | null
          subject_email: string | null
          subject_user_id: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_url?: string | null
          executed_at?: string | null
          export_expires_at?: string | null
          export_url?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          preview_counts?: Json | null
          receipt_id?: string | null
          request_type: string
          requester_email?: string | null
          requester_user_id?: string | null
          scheduled_purge_at?: string | null
          status?: string
          subject_customer_id?: string | null
          subject_email?: string | null
          subject_user_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_url?: string | null
          executed_at?: string | null
          export_expires_at?: string | null
          export_url?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          preview_counts?: Json | null
          receipt_id?: string | null
          request_type?: string
          requester_email?: string | null
          requester_user_id?: string | null
          scheduled_purge_at?: string | null
          status?: string
          subject_customer_id?: string | null
          subject_email?: string | null
          subject_user_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          executed_at: string | null
          id: string
          ip_address: string | null
          preview_counts: Json | null
          receipt_id: string | null
          request_type: string
          requested_by: string
          scheduled_deletion_at: string | null
          status: string | null
          team_id: string
          user_agent: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          ip_address?: string | null
          preview_counts?: Json | null
          receipt_id?: string | null
          request_type: string
          requested_by: string
          scheduled_deletion_at?: string | null
          status?: string | null
          team_id: string
          user_agent?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          executed_at?: string | null
          id?: string
          ip_address?: string | null
          preview_counts?: Json | null
          receipt_id?: string | null
          request_type?: string
          requested_by?: string
          scheduled_deletion_at?: string | null
          status?: string | null
          team_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_intelligence_cache: {
        Row: {
          city: string
          created_at: string | null
          end_date: string
          expires_at: string | null
          id: string
          response: Json
          start_date: string
        }
        Insert: {
          city: string
          created_at?: string | null
          end_date: string
          expires_at?: string | null
          id?: string
          response: Json
          start_date: string
        }
        Update: {
          city?: string
          created_at?: string | null
          end_date?: string
          expires_at?: string | null
          id?: string
          response?: Json
          start_date?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          billing_frequency: string | null
          booking_id: string | null
          created_at: string | null
          customer_id: string | null
          doc_ref: string | null
          email_sent_at: string | null
          expires_at: string | null
          file_size: number | null
          file_url: string
          id: string
          is_default: boolean | null
          name: string
          parent_document_id: string | null
          premium_amount: number | null
          signature_image_url: string | null
          signed_at: string | null
          signed_by_name: string | null
          signing_metadata: Json | null
          status: string | null
          team_id: string | null
          type: string
          updated_at: string | null
          user_id: string
          vehicle_id: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          billing_frequency?: string | null
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          doc_ref?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_default?: boolean | null
          name: string
          parent_document_id?: string | null
          premium_amount?: number | null
          signature_image_url?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signing_metadata?: Json | null
          status?: string | null
          team_id?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          vehicle_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          billing_frequency?: string | null
          booking_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          doc_ref?: string | null
          email_sent_at?: string | null
          expires_at?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_default?: boolean | null
          name?: string
          parent_document_id?: string | null
          premium_amount?: number | null
          signature_image_url?: string | null
          signed_at?: string | null
          signed_by_name?: string | null
          signing_metadata?: Json | null
          status?: string | null
          team_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_comment_reads: {
        Row: {
          entity_id: string
          entity_type: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entity_comments: {
        Row: {
          attachments: Json | null
          content: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          is_resolved: boolean | null
          mentions: string[] | null
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_resolved?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_resolved?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entity_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          can_retry: boolean | null
          column_mappings: Json | null
          completed_at: string | null
          created_at: string | null
          entity_type: string
          error_details: Json | null
          failed_count: number | null
          failed_rows: Json | null
          file_name: string | null
          id: string
          imported_count: number | null
          original_file_url: string | null
          skipped_count: number | null
          status: string | null
          team_id: string | null
          total_rows: number | null
          user_id: string
        }
        Insert: {
          can_retry?: boolean | null
          column_mappings?: Json | null
          completed_at?: string | null
          created_at?: string | null
          entity_type: string
          error_details?: Json | null
          failed_count?: number | null
          failed_rows?: Json | null
          file_name?: string | null
          id?: string
          imported_count?: number | null
          original_file_url?: string | null
          skipped_count?: number | null
          status?: string | null
          team_id?: string | null
          total_rows?: number | null
          user_id: string
        }
        Update: {
          can_retry?: boolean | null
          column_mappings?: Json | null
          completed_at?: string | null
          created_at?: string | null
          entity_type?: string
          error_details?: Json | null
          failed_count?: number | null
          failed_rows?: Json | null
          file_name?: string | null
          id?: string
          imported_count?: number | null
          original_file_url?: string | null
          skipped_count?: number | null
          status?: string | null
          team_id?: string | null
          total_rows?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_damage_items: {
        Row: {
          created_at: string | null
          damage_type: string
          id: string
          inspection_id: string
          notes: string | null
          photo_url: string
          quality_warning: boolean | null
          severity: string | null
          vehicle_location: string
        }
        Insert: {
          created_at?: string | null
          damage_type: string
          id?: string
          inspection_id: string
          notes?: string | null
          photo_url: string
          quality_warning?: boolean | null
          severity?: string | null
          vehicle_location: string
        }
        Update: {
          created_at?: string | null
          damage_type?: string
          id?: string
          inspection_id?: string
          notes?: string | null
          photo_url?: string
          quality_warning?: boolean | null
          severity?: string | null
          vehicle_location?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_damage_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          captured_at: string | null
          description: string | null
          id: string
          inspection_id: string
          photo_role: string | null
          photo_type: string | null
          photo_url: string
          quality_warning: boolean | null
          skipped: boolean | null
          uploaded_at: string | null
        }
        Insert: {
          captured_at?: string | null
          description?: string | null
          id?: string
          inspection_id: string
          photo_role?: string | null
          photo_type?: string | null
          photo_url: string
          quality_warning?: boolean | null
          skipped?: boolean | null
          uploaded_at?: string | null
        }
        Update: {
          captured_at?: string | null
          description?: string | null
          id?: string
          inspection_id?: string
          photo_role?: string | null
          photo_type?: string | null
          photo_url?: string
          quality_warning?: boolean | null
          skipped?: boolean | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "vehicle_inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          last_used_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      legal_document_versions: {
        Row: {
          content_hash: string
          content_text: string
          created_at: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          effective_date: string
          hash_algorithm: string
          id: string
          published_at: string
          url: string
          version: string
        }
        Insert: {
          content_hash: string
          content_text: string
          created_at?: string
          document_type: Database["public"]["Enums"]["legal_document_type"]
          effective_date: string
          hash_algorithm?: string
          id?: string
          published_at?: string
          url: string
          version: string
        }
        Update: {
          content_hash?: string
          content_text?: string
          created_at?: string
          document_type?: Database["public"]["Enums"]["legal_document_type"]
          effective_date?: string
          hash_algorithm?: string
          id?: string
          published_at?: string
          url?: string
          version?: string
        }
        Relationships: []
      }
      location_staff: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          is_primary: boolean | null
          location_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_primary?: boolean | null
          location_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_primary?: boolean | null
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_staff_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          phone: string | null
          settings: Json | null
          state: string | null
          team_id: string
          timezone: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          phone?: string | null
          settings?: Json | null
          state?: string | null
          team_id: string
          timezone?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          phone?: string | null
          settings?: Json | null
          state?: string | null
          team_id?: string
          timezone?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_notify_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          team_id: string | null
          window_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          team_id?: string | null
          window_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          team_id?: string | null
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_notify_subscribers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notify_subscribers_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "maintenance_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          actual_cost: number | null
          completed_at: string | null
          created_at: string
          estimated_cost: number | null
          id: string
          last_completed_at: string | null
          last_completed_mileage: number | null
          location_id: string | null
          maintenance_type: string
          notes: string | null
          recurrence_interval_days: number | null
          recurrence_mileage_interval: number | null
          recurrence_type: string | null
          scheduled_date: string
          service_provider: string | null
          status: string | null
          team_id: string | null
          template_name: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: string
          last_completed_at?: string | null
          last_completed_mileage?: number | null
          location_id?: string | null
          maintenance_type: string
          notes?: string | null
          recurrence_interval_days?: number | null
          recurrence_mileage_interval?: number | null
          recurrence_type?: string | null
          scheduled_date: string
          service_provider?: string | null
          status?: string | null
          team_id?: string | null
          template_name?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: string
          last_completed_at?: string | null
          last_completed_mileage?: number | null
          location_id?: string | null
          maintenance_type?: string
          notes?: string | null
          recurrence_interval_days?: number | null
          recurrence_mileage_interval?: number | null
          recurrence_type?: string | null
          scheduled_date?: string
          service_provider?: string | null
          status?: string | null
          team_id?: string | null
          template_name?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_windows: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          eta: string | null
          id: string
          is_active: boolean
          message: string | null
          scope: string
          started_at: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          eta?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          scope: string
          started_at?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          eta?: string | null
          id?: string
          is_active?: boolean
          message?: string | null
          scope?: string
          started_at?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_windows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mention_notifications_log: {
        Row: {
          channel: string
          comment_id: string | null
          conversation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message_id: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          channel: string
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message_id?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          channel?: string
          comment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message_id?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string
          id: string
          message_type: string
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          sent_at: string
          status: string | null
          subject: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string
          id?: string
          message_type: string
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          sent_at?: string
          status?: string | null
          subject?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string
          id?: string
          message_type?: string
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          sent_at?: string
          status?: string | null
          subject?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "messages_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          digest_email_enabled: boolean
          digest_enabled: boolean
          digest_frequency: string
          email_direct_messages: boolean
          email_mentions: boolean
          email_team_updates: boolean
          id: string
          muted_threads: Json
          push_enabled: boolean
          slack_bookings: boolean
          slack_enabled: boolean
          slack_mentions: boolean
          slack_payments: boolean
          slack_webhook_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_email_enabled?: boolean
          digest_enabled?: boolean
          digest_frequency?: string
          email_direct_messages?: boolean
          email_mentions?: boolean
          email_team_updates?: boolean
          id?: string
          muted_threads?: Json
          push_enabled?: boolean
          slack_bookings?: boolean
          slack_enabled?: boolean
          slack_mentions?: boolean
          slack_payments?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_email_enabled?: boolean
          digest_enabled?: boolean
          digest_frequency?: string
          email_direct_messages?: boolean
          email_mentions?: boolean
          email_team_updates?: boolean
          id?: string
          muted_threads?: Json
          push_enabled?: boolean
          slack_bookings?: boolean
          slack_enabled?: boolean
          slack_mentions?: boolean
          slack_payments?: boolean
          slack_webhook_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          ref: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          ref?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          ref?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          current_step: number
          form_data: Json | null
          id: string
          last_activity_at: string | null
          onboarding_type: string | null
          referral_code: string | null
          source: string | null
          started_at: string | null
          steps_completed: number[] | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          form_data?: Json | null
          id?: string
          last_activity_at?: string | null
          onboarding_type?: string | null
          referral_code?: string | null
          source?: string | null
          started_at?: string | null
          steps_completed?: number[] | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          form_data?: Json | null
          id?: string
          last_activity_at?: string | null
          onboarding_type?: string | null
          referral_code?: string | null
          source?: string | null
          started_at?: string | null
          steps_completed?: number[] | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_responses: {
        Row: {
          business_name: string | null
          created_at: string
          current_software: string | null
          fleet_size: string | null
          id: string
          location: string | null
          pain_points: string | null
          phone: string | null
          referral_source: string | null
          session_id: string | null
          updated_at: string
          user_id: string | null
          vehicle_types: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          current_software?: string | null
          fleet_size?: string | null
          id?: string
          location?: string | null
          pain_points?: string | null
          phone?: string | null
          referral_source?: string | null
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_types?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          current_software?: string | null
          fleet_size?: string | null
          id?: string
          location?: string | null
          pain_points?: string | null
          phone?: string | null
          referral_source?: string | null
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
          vehicle_types?: string | null
        }
        Relationships: []
      }
      partner_payouts: {
        Row: {
          booking_id: string
          created_at: string
          currency: string
          gross_rental_base: number
          id: string
          net_after_fee: number
          net_to_partner: number
          notes: string | null
          operator_adjustments: number
          paid_at: string | null
          partner_id: string
          payout_method: string | null
          payout_reference: string | null
          platform_fee_amount: number
          reconcile_flag: boolean
          reconcile_note: string | null
          split_type: string
          split_value_snapshot: number
          status: string
          team_id: string
          updated_at: string
          vehicle_id: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          currency?: string
          gross_rental_base?: number
          id?: string
          net_after_fee?: number
          net_to_partner?: number
          notes?: string | null
          operator_adjustments?: number
          paid_at?: string | null
          partner_id: string
          payout_method?: string | null
          payout_reference?: string | null
          platform_fee_amount?: number
          reconcile_flag?: boolean
          reconcile_note?: string | null
          split_type: string
          split_value_snapshot: number
          status?: string
          team_id: string
          updated_at?: string
          vehicle_id: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          currency?: string
          gross_rental_base?: number
          id?: string
          net_after_fee?: number
          net_to_partner?: number
          notes?: string | null
          operator_adjustments?: number
          paid_at?: string | null
          partner_id?: string
          payout_method?: string | null
          payout_reference?: string | null
          platform_fee_amount?: number
          reconcile_flag?: boolean
          reconcile_note?: string | null
          split_type?: string
          split_value_snapshot?: number
          status?: string
          team_id?: string
          updated_at?: string
          vehicle_id?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: []
      }
      payment_receipts: {
        Row: {
          created_at: string | null
          export_format: string | null
          exported_at: string | null
          id: string
          payment_id: string | null
          receipt_number: string | null
          receipt_url: string | null
        }
        Insert: {
          created_at?: string | null
          export_format?: string | null
          exported_at?: string | null
          id?: string
          payment_id?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
        }
        Update: {
          created_at?: string | null
          export_format?: string | null
          exported_at?: string | null
          id?: string
          payment_id?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          customer_id: string | null
          hold_expires_at: string | null
          hold_status: string | null
          id: string
          notes: string | null
          original_amount: number | null
          payment_method: string | null
          payment_status: string | null
          payment_type: string
          platform_fee: number | null
          refund_amount: number | null
          refund_reason: string | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_refund_id: string | null
          team_id: string | null
          transaction_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          customer_id?: string | null
          hold_expires_at?: string | null
          hold_status?: string | null
          id?: string
          notes?: string | null
          original_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          payment_type: string
          platform_fee?: number | null
          refund_amount?: number | null
          refund_reason?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          team_id?: string | null
          transaction_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          customer_id?: string | null
          hold_expires_at?: string | null
          hold_status?: string | null
          id?: string
          notes?: string | null
          original_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          payment_type?: string
          platform_fee?: number | null
          refund_amount?: number | null
          refund_reason?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_refund_id?: string | null
          team_id?: string | null
          transaction_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          arrival_date: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          status: string | null
          stripe_payout_id: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          arrival_date?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          status?: string | null
          stripe_payout_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          arrival_date?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          status?: string | null
          stripe_payout_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_upload_batches: {
        Row: {
          batch_name: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          failed_files: number | null
          id: string
          matched_files: number | null
          processed_files: number | null
          source: string | null
          started_at: string | null
          status: string | null
          team_id: string | null
          total_files: number | null
          unmatched_files: number | null
          user_id: string
        }
        Insert: {
          batch_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_files?: number | null
          id?: string
          matched_files?: number | null
          processed_files?: number | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          total_files?: number | null
          unmatched_files?: number | null
          user_id: string
        }
        Update: {
          batch_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          failed_files?: number | null
          id?: string
          matched_files?: number | null
          processed_files?: number | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          total_files?: number | null
          unmatched_files?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_upload_batches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_messages: {
        Row: {
          conversation_id: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          conversation_id: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          conversation_id?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "team_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_address: Json | null
          business_type: string | null
          company_name: string | null
          created_at: string | null
          email: string
          fleet_size: string | null
          full_name: string | null
          handle: string | null
          handle_changed_at: string | null
          id: string
          is_active: boolean
          location: string | null
          number_of_locations: number | null
          onboarding_completed: boolean | null
          phone: string | null
          tour_completed: boolean | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_address?: Json | null
          business_type?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          fleet_size?: string | null
          full_name?: string | null
          handle?: string | null
          handle_changed_at?: string | null
          id: string
          is_active?: boolean
          location?: string | null
          number_of_locations?: number | null
          onboarding_completed?: boolean | null
          phone?: string | null
          tour_completed?: boolean | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_address?: Json | null
          business_type?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          fleet_size?: string | null
          full_name?: string | null
          handle?: string | null
          handle_changed_at?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          number_of_locations?: number | null
          onboarding_completed?: boolean | null
          phone?: string | null
          tour_completed?: boolean | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      purged_vehicle_fingerprints: {
        Row: {
          created_at: string
          id: string
          prior_peak: number
          purged_at: string
          team_id: string
          vin: string
        }
        Insert: {
          created_at?: string
          id?: string
          prior_peak?: number
          purged_at?: string
          team_id: string
          vin: string
        }
        Update: {
          created_at?: string
          id?: string
          prior_peak?: number
          purged_at?: string
          team_id?: string
          vin?: string
        }
        Relationships: []
      }
      rari_conversations: {
        Row: {
          context_summary: string | null
          created_at: string
          ended_at: string | null
          id: string
          message_count: number | null
          session_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          context_summary?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          message_count?: number | null
          session_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          context_summary?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          message_count?: number | null
          session_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rari_feedback: {
        Row: {
          context: Json | null
          created_at: string
          feedback_type: string
          id: string
          keywords: string[] | null
          rari_response: string | null
          resolved: boolean | null
          user_id: string
          user_query: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          feedback_type?: string
          id?: string
          keywords?: string[] | null
          rari_response?: string | null
          resolved?: boolean | null
          user_id: string
          user_query?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          feedback_type?: string
          id?: string
          keywords?: string[] | null
          rari_response?: string | null
          resolved?: boolean | null
          user_id?: string
          user_query?: string | null
        }
        Relationships: []
      }
      rari_insights: {
        Row: {
          action_items: Json | null
          created_at: string
          description: string
          expires_at: string | null
          id: string
          insight_type: string
          is_dismissed: boolean
          is_read: boolean
          metadata: Json | null
          priority: string
          related_entity_id: string | null
          related_entity_type: string | null
          team_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: Json | null
          created_at?: string
          description: string
          expires_at?: string | null
          id?: string
          insight_type: string
          is_dismissed?: boolean
          is_read?: boolean
          metadata?: Json | null
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          team_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: Json | null
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          insight_type?: string
          is_dismissed?: boolean
          is_read?: boolean
          metadata?: Json | null
          priority?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rari_insights_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rari_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          entities: Json | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          entities?: Json | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          entities?: Json | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "rari_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "rari_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expense_templates: {
        Row: {
          amount: number
          cadence: string
          created_at: string
          created_by: string | null
          day_of_month: number
          expense_type: string
          id: string
          is_active: boolean
          last_run_at: string | null
          location_id: string | null
          name: string
          next_run_at: string
          notes: string | null
          team_id: string
          updated_at: string
          vehicle_id: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          cadence: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          expense_type: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          location_id?: string | null
          name: string
          next_run_at: string
          notes?: string | null
          team_id: string
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          cadence?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          expense_type?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          location_id?: string | null
          name?: string
          next_run_at?: string
          notes?: string | null
          team_id?: string
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      retention_policies: {
        Row: {
          action: string
          basis: string
          created_at: string
          enabled: boolean
          entity_type: string
          id: string
          last_affected_count: number | null
          last_run_at: string | null
          last_run_dry_run: boolean | null
          notes: string | null
          retention_days: number
          updated_at: string
        }
        Insert: {
          action?: string
          basis: string
          created_at?: string
          enabled?: boolean
          entity_type: string
          id?: string
          last_affected_count?: number | null
          last_run_at?: string | null
          last_run_dry_run?: boolean | null
          notes?: string | null
          retention_days: number
          updated_at?: string
        }
        Update: {
          action?: string
          basis?: string
          created_at?: string
          enabled?: boolean
          entity_type?: string
          id?: string
          last_affected_count?: number | null
          last_run_at?: string | null
          last_run_dry_run?: boolean | null
          notes?: string | null
          retention_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      retention_sweep_log: {
        Row: {
          deleted_count: number
          dry_run: boolean
          entity_type: string
          error: string | null
          id: string
          ran_at: string
          retention_days: number
          would_delete_count: number
        }
        Insert: {
          deleted_count?: number
          dry_run: boolean
          entity_type: string
          error?: string | null
          id?: string
          ran_at?: string
          retention_days: number
          would_delete_count?: number
        }
        Update: {
          deleted_count?: number
          dry_run?: boolean
          entity_type?: string
          error?: string | null
          id?: string
          ran_at?: string
          retention_days?: number
          would_delete_count?: number
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          new_permissions: string[] | null
          new_role: string | null
          old_permissions: string[] | null
          old_role: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_permissions?: string[] | null
          new_role?: string | null
          old_permissions?: string[] | null
          old_role?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_permissions?: string[] | null
          new_role?: string | null
          old_permissions?: string[] | null
          old_role?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          stripe_event_id: string
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
          stripe_event_id: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      sub_processors: {
        Row: {
          created_at: string
          dpa_url: string | null
          id: string
          name: string
          notes: string | null
          privacy_policy_url: string | null
          purpose: string
          region: string
          status: string
          transfer_mechanism: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dpa_url?: string | null
          id?: string
          name: string
          notes?: string | null
          privacy_policy_url?: string | null
          purpose: string
          region: string
          status?: string
          transfer_mechanism?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dpa_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          privacy_policy_url?: string | null
          purpose?: string
          region?: string
          status?: string
          transfer_mechanism?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          notes: string | null
          permissions: string[] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          notes?: string | null
          permissions?: string[] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          notes?: string | null
          permissions?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
      team_conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_company_wide: boolean | null
          name: string | null
          team_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_company_wide?: boolean | null
          name?: string | null
          team_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_company_wide?: boolean | null
          name?: string | null
          team_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_group_members: {
        Row: {
          added_by: string | null
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "team_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      team_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_groups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_integrations: {
        Row: {
          config: Json
          configured_by: string | null
          created_at: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          last_used_at: string | null
          team_id: string
          updated_at: string | null
        }
        Insert: {
          config?: Json
          configured_by?: string | null
          created_at?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          last_used_at?: string | null
          team_id: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          configured_by?: string | null
          created_at?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          last_used_at?: string | null
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_integrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          attachments: Json | null
          content: string
          conversation_id: string
          created_at: string | null
          edited_at: string | null
          id: string
          is_edited: boolean | null
          is_pinned: boolean | null
          mentions: string[] | null
          message_type: string | null
          reactions: Json | null
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          content: string
          conversation_id: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          is_pinned?: boolean | null
          mentions?: string[] | null
          message_type?: string | null
          reactions?: Json | null
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          is_pinned?: boolean | null
          mentions?: string[] | null
          message_type?: string | null
          reactions?: Json | null
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "team_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          ai_data_minimization_level: string
          assumed_plan_fleet_size: number | null
          assumed_plan_is_annual: boolean | null
          assumed_plan_tier: string | null
          billing_dunning_message: string | null
          billing_dunning_notes: string | null
          billing_dunning_set_at: string | null
          billing_dunning_set_by: string | null
          billing_dunning_stage: string | null
          business_address: Json | null
          country_code: string
          created_at: string | null
          currency: string
          data_region: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_scheduled_for: string | null
          eu_representative_address: string | null
          eu_representative_email: string | null
          eu_representative_name: string | null
          expense_auto_approve_under: number
          expense_review_required_types: string[]
          id: string
          invoice_sequence: number
          is_deleted: boolean | null
          is_demo_account: boolean | null
          locale: string
          logo_url: string | null
          marketplace_visible: boolean
          min_rate: number | null
          name: string
          owner_id: string
          platform_fee_percent: number
          primary_jurisdiction: string | null
          public_description: string | null
          rental_buffer_minutes: number | null
          seat_audit_reviewed_at: string | null
          seat_audit_reviewed_by: string | null
          settings: Json | null
          slug: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_onboarding_complete: boolean
          stripe_payouts_enabled: boolean
          tax_inclusive: boolean
          tax_label: string
          tax_rate_percent: number
          timezone: string | null
          trial_end: string | null
          trial_start: string | null
          uk_representative_address: string | null
          uk_representative_email: string | null
          uk_representative_name: string | null
          updated_at: string | null
          vat_number: string | null
        }
        Insert: {
          ai_data_minimization_level?: string
          assumed_plan_fleet_size?: number | null
          assumed_plan_is_annual?: boolean | null
          assumed_plan_tier?: string | null
          billing_dunning_message?: string | null
          billing_dunning_notes?: string | null
          billing_dunning_set_at?: string | null
          billing_dunning_set_by?: string | null
          billing_dunning_stage?: string | null
          business_address?: Json | null
          country_code?: string
          created_at?: string | null
          currency?: string
          data_region?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_scheduled_for?: string | null
          eu_representative_address?: string | null
          eu_representative_email?: string | null
          eu_representative_name?: string | null
          expense_auto_approve_under?: number
          expense_review_required_types?: string[]
          id?: string
          invoice_sequence?: number
          is_deleted?: boolean | null
          is_demo_account?: boolean | null
          locale?: string
          logo_url?: string | null
          marketplace_visible?: boolean
          min_rate?: number | null
          name: string
          owner_id: string
          platform_fee_percent?: number
          primary_jurisdiction?: string | null
          public_description?: string | null
          rental_buffer_minutes?: number | null
          seat_audit_reviewed_at?: string | null
          seat_audit_reviewed_by?: string | null
          settings?: Json | null
          slug?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          tax_inclusive?: boolean
          tax_label?: string
          tax_rate_percent?: number
          timezone?: string | null
          trial_end?: string | null
          trial_start?: string | null
          uk_representative_address?: string | null
          uk_representative_email?: string | null
          uk_representative_name?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Update: {
          ai_data_minimization_level?: string
          assumed_plan_fleet_size?: number | null
          assumed_plan_is_annual?: boolean | null
          assumed_plan_tier?: string | null
          billing_dunning_message?: string | null
          billing_dunning_notes?: string | null
          billing_dunning_set_at?: string | null
          billing_dunning_set_by?: string | null
          billing_dunning_stage?: string | null
          business_address?: Json | null
          country_code?: string
          created_at?: string | null
          currency?: string
          data_region?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_scheduled_for?: string | null
          eu_representative_address?: string | null
          eu_representative_email?: string | null
          eu_representative_name?: string | null
          expense_auto_approve_under?: number
          expense_review_required_types?: string[]
          id?: string
          invoice_sequence?: number
          is_deleted?: boolean | null
          is_demo_account?: boolean | null
          locale?: string
          logo_url?: string | null
          marketplace_visible?: boolean
          min_rate?: number | null
          name?: string
          owner_id?: string
          platform_fee_percent?: number
          primary_jurisdiction?: string | null
          public_description?: string | null
          rental_buffer_minutes?: number | null
          seat_audit_reviewed_at?: string | null
          seat_audit_reviewed_by?: string | null
          settings?: Json | null
          slug?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_onboarding_complete?: boolean
          stripe_payouts_enabled?: boolean
          tax_inclusive?: boolean
          tax_label?: string
          tax_rate_percent?: number
          timezone?: string | null
          trial_end?: string | null
          trial_start?: string | null
          uk_representative_address?: string | null
          uk_representative_email?: string | null
          uk_representative_name?: string | null
          updated_at?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      tenant_document_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json
          tenant_document_id: string
          user_agent: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          tenant_document_id: string
          user_agent?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          tenant_document_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_document_audit_tenant_document_id_fkey"
            columns: ["tenant_document_id"]
            isOneToOne: false
            referencedRelation: "tenant_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_documents: {
        Row: {
          created_at: string
          doc_ref: string | null
          field_overlay: Json
          id: string
          original_sha256: string | null
          original_storage_path: string
          sent_at: string
          sent_by_super_admin_id: string
          signed_at: string | null
          signed_document_id: string | null
          signed_sha256: string | null
          signed_storage_path: string | null
          signer_email: string | null
          signer_name: string | null
          signer_title: string | null
          signing_metadata: Json
          status: Database["public"]["Enums"]["tenant_document_status"]
          team_id: string
          template: Database["public"]["Enums"]["tenant_document_template"]
          title: string
          updated_at: string
          viewed_at: string | null
          voided_at: string | null
          voided_reason: string | null
        }
        Insert: {
          created_at?: string
          doc_ref?: string | null
          field_overlay?: Json
          id?: string
          original_sha256?: string | null
          original_storage_path: string
          sent_at?: string
          sent_by_super_admin_id: string
          signed_at?: string | null
          signed_document_id?: string | null
          signed_sha256?: string | null
          signed_storage_path?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_title?: string | null
          signing_metadata?: Json
          status?: Database["public"]["Enums"]["tenant_document_status"]
          team_id: string
          template?: Database["public"]["Enums"]["tenant_document_template"]
          title: string
          updated_at?: string
          viewed_at?: string | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Update: {
          created_at?: string
          doc_ref?: string | null
          field_overlay?: Json
          id?: string
          original_sha256?: string | null
          original_storage_path?: string
          sent_at?: string
          sent_by_super_admin_id?: string
          signed_at?: string | null
          signed_document_id?: string | null
          signed_sha256?: string | null
          signed_storage_path?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_title?: string | null
          signing_metadata?: Json
          status?: Database["public"]["Enums"]["tenant_document_status"]
          team_id?: string
          template?: Database["public"]["Enums"]["tenant_document_template"]
          title?: string
          updated_at?: string
          viewed_at?: string | null
          voided_at?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_documents_signed_document_id_fkey"
            columns: ["signed_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_documents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invoices: {
        Row: {
          booking_id: string | null
          created_at: string
          currency: string
          customer_snapshot: Json
          id: string
          invoice_number: string
          issued_at: string
          line_items: Json
          pdf_storage_path: string | null
          subtotal: number
          supplier_snapshot: Json
          tax_amount: number
          tax_inclusive: boolean
          tax_point_date: string
          tax_rate_percent: number
          team_id: string
          total: number
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          currency: string
          customer_snapshot: Json
          id?: string
          invoice_number: string
          issued_at?: string
          line_items?: Json
          pdf_storage_path?: string | null
          subtotal: number
          supplier_snapshot: Json
          tax_amount: number
          tax_inclusive?: boolean
          tax_point_date: string
          tax_rate_percent: number
          team_id: string
          total: number
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          currency?: string
          customer_snapshot?: Json
          id?: string
          invoice_number?: string
          issued_at?: string
          line_items?: Json
          pdf_storage_path?: string | null
          subtotal?: number
          supplier_snapshot?: Json
          tax_amount?: number
          tax_inclusive?: boolean
          tax_point_date?: string
          tax_rate_percent?: number
          team_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "tenant_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "tenant_invoices_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          acceptance_method: Database["public"]["Enums"]["terms_acceptance_method"]
          accepted_at: string
          actor_display_name: string | null
          actor_email: string | null
          auth_context: string | null
          consent_statement: string
          created_at: string
          documents_accepted: Json
          event_type: Database["public"]["Enums"]["terms_acceptance_event"]
          id: string
          ip_address: unknown
          is_authorized_representative: boolean
          page_url: string | null
          team_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acceptance_method?: Database["public"]["Enums"]["terms_acceptance_method"]
          accepted_at?: string
          actor_display_name?: string | null
          actor_email?: string | null
          auth_context?: string | null
          consent_statement: string
          created_at?: string
          documents_accepted: Json
          event_type: Database["public"]["Enums"]["terms_acceptance_event"]
          id?: string
          ip_address?: unknown
          is_authorized_representative?: boolean
          page_url?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acceptance_method?: Database["public"]["Enums"]["terms_acceptance_method"]
          accepted_at?: string
          actor_display_name?: string | null
          actor_email?: string | null
          auth_context?: string | null
          consent_statement?: string
          created_at?: string
          documents_accepted?: Json
          event_type?: Database["public"]["Enums"]["terms_acceptance_event"]
          id?: string
          ip_address?: unknown
          is_authorized_representative?: boolean
          page_url?: string | null
          team_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      unmatched_photos: {
        Row: {
          ai_analysis: Json | null
          batch_id: string | null
          created_at: string | null
          id: string
          matched_vehicle_id: string | null
          original_filename: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          storage_path: string
          suggested_color: string | null
          suggested_make: string | null
          suggested_model: string | null
          suggested_vehicle_id: string | null
          suggestion_confidence: number | null
          team_id: string | null
          url: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          batch_id?: string | null
          created_at?: string | null
          id?: string
          matched_vehicle_id?: string | null
          original_filename?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          storage_path: string
          suggested_color?: string | null
          suggested_make?: string | null
          suggested_model?: string | null
          suggested_vehicle_id?: string | null
          suggestion_confidence?: number | null
          team_id?: string | null
          url: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          batch_id?: string | null
          created_at?: string | null
          id?: string
          matched_vehicle_id?: string | null
          original_filename?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          storage_path?: string
          suggested_color?: string | null
          suggested_make?: string | null
          suggested_model?: string | null
          suggested_vehicle_id?: string | null
          suggestion_confidence?: number | null
          team_id?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_photos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "photo_upload_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmatched_photos_matched_vehicle_id_fkey"
            columns: ["matched_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmatched_photos_suggested_vehicle_id_fkey"
            columns: ["suggested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmatched_photos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      uptime_checks: {
        Row: {
          checked_at: string
          created_at: string
          failure_reason: string | null
          http_status: number | null
          id: string
          latency_ms: number | null
          status: string
          target_url: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          failure_reason?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          status: string
          target_url: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          failure_reason?: string | null
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          status?: string
          target_url?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          activity_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          team_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          team_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          team_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          created_at: string
          id: string
          layout_data: Json
          updated_at: string
          user_id: string
          visible_widgets: Json
        }
        Insert: {
          created_at?: string
          id?: string
          layout_data?: Json
          updated_at?: string
          user_id: string
          visible_widgets?: Json
        }
        Update: {
          created_at?: string
          id?: string
          layout_data?: Json
          updated_at?: string
          user_id?: string
          visible_widgets?: Json
        }
        Relationships: []
      }
      user_dashboard_preferences: {
        Row: {
          banner_url: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          permissions: string[] | null
          role: string | null
          status: string | null
          team_id: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          permissions?: string[] | null
          role?: string | null
          status?: string | null
          team_id?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          permissions?: string[] | null
          role?: string | null
          status?: string | null
          team_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          last_seen: string
          status: string
          typing_in_conversation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          status?: string
          typing_in_conversation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen?: string
          status?: string
          typing_in_conversation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_typing_in_conversation_fkey"
            columns: ["typing_in_conversation"]
            isOneToOne: false
            referencedRelation: "team_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          permissions: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          category: string
          created_at: string | null
          id: string
          settings: Json
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          settings?: Json
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          settings?: Json
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_billing_snapshots: {
        Row: {
          active_count: number
          created_at: string
          id: string
          snapshot_date: string
          team_id: string
          total_billable: number
          trashed_count: number
        }
        Insert: {
          active_count?: number
          created_at?: string
          id?: string
          snapshot_date: string
          team_id: string
          total_billable?: number
          trashed_count?: number
        }
        Update: {
          active_count?: number
          created_at?: string
          id?: string
          snapshot_date?: string
          team_id?: string
          total_billable?: number
          trashed_count?: number
        }
        Relationships: []
      }
      vehicle_change_log: {
        Row: {
          change_source: string | null
          created_at: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          team_id: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          change_source?: string | null
          created_at?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          team_id?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          change_source?: string | null
          created_at?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          team_id?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_expenses: {
        Row: {
          ai_confidence: number | null
          ai_parsed_fields: Json | null
          amount: number
          approval_threshold_applied: number | null
          auto_routed_reason: string | null
          booking_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          expense_date: string
          expense_type: string
          id: string
          is_reimbursable: boolean
          linked_damage_claim_id: string | null
          location_id: string | null
          notes: string | null
          receipt_url: string | null
          reimbursed_amount: number
          requires_admin_approval: boolean
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_module: string
          source_record_id: string | null
          status: string
          team_id: string
          updated_at: string
          vehicle_id: string | null
          vendor: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_parsed_fields?: Json | null
          amount: number
          approval_threshold_applied?: number | null
          auto_routed_reason?: string | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expense_date?: string
          expense_type: string
          id?: string
          is_reimbursable?: boolean
          linked_damage_claim_id?: string | null
          location_id?: string | null
          notes?: string | null
          receipt_url?: string | null
          reimbursed_amount?: number
          requires_admin_approval?: boolean
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_module?: string
          source_record_id?: string | null
          status?: string
          team_id: string
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_parsed_fields?: Json | null
          amount?: number
          approval_threshold_applied?: number | null
          auto_routed_reason?: string | null
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expense_date?: string
          expense_type?: string
          id?: string
          is_reimbursable?: boolean
          linked_damage_claim_id?: string | null
          location_id?: string | null
          notes?: string | null
          receipt_url?: string | null
          reimbursed_amount?: number
          requires_admin_approval?: boolean
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_module?: string
          source_record_id?: string | null
          status?: string
          team_id?: string
          updated_at?: string
          vehicle_id?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      vehicle_inspections: {
        Row: {
          booking_id: string | null
          cleanliness_rating: number | null
          completed_at: string | null
          created_at: string | null
          device_info: Json | null
          exterior_condition: string | null
          fuel_level: number
          id: string
          inspection_direction: string | null
          inspection_type: string
          inspector_name: string | null
          interior_condition: string | null
          keys_count: number | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          odometer_reading: number
          report_url: string | null
          report_web_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signature_url: string | null
          started_at: string | null
          status: string | null
          team_id: string | null
          tire_condition: string | null
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          booking_id?: string | null
          cleanliness_rating?: number | null
          completed_at?: string | null
          created_at?: string | null
          device_info?: Json | null
          exterior_condition?: string | null
          fuel_level: number
          id?: string
          inspection_direction?: string | null
          inspection_type: string
          inspector_name?: string | null
          interior_condition?: string | null
          keys_count?: number | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          odometer_reading: number
          report_url?: string | null
          report_web_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          tire_condition?: string | null
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          booking_id?: string | null
          cleanliness_rating?: number | null
          completed_at?: string | null
          created_at?: string | null
          device_info?: Json | null
          exterior_condition?: string | null
          fuel_level?: number
          id?: string
          inspection_direction?: string | null
          inspection_type?: string
          inspector_name?: string | null
          interior_condition?: string | null
          keys_count?: number | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          odometer_reading?: number
          report_url?: string | null
          report_web_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          tire_condition?: string | null
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_inspections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_payment_summary"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "vehicle_inspections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "deposit_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "vehicle_inspections_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_inspections_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_partners: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payout_method: string | null
          phone: string | null
          stripe_connect_account_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payout_method?: string | null
          phone?: string | null
          stripe_connect_account_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payout_method?: string | null
          phone?: string | null
          stripe_connect_account_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_photos: {
        Row: {
          ai_analysis: Json | null
          analyzed_at: string | null
          created_at: string | null
          detected_angle: string | null
          display_order: number | null
          enhanced_at: string | null
          enhanced_url: string | null
          enhancement_settings: Json | null
          file_size_bytes: number | null
          generation_prompt: string | null
          height: number | null
          id: string
          is_enhanced: boolean | null
          is_vehicle_confirmed: boolean | null
          is_visible: boolean | null
          mime_type: string | null
          original_filename: string | null
          photo_type: string | null
          quality_issues: string[] | null
          quality_score: number | null
          source: string | null
          storage_path: string
          team_id: string | null
          thumbnail_url: string | null
          updated_at: string | null
          url: string
          user_id: string
          vehicle_id: string
          width: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          analyzed_at?: string | null
          created_at?: string | null
          detected_angle?: string | null
          display_order?: number | null
          enhanced_at?: string | null
          enhanced_url?: string | null
          enhancement_settings?: Json | null
          file_size_bytes?: number | null
          generation_prompt?: string | null
          height?: number | null
          id?: string
          is_enhanced?: boolean | null
          is_vehicle_confirmed?: boolean | null
          is_visible?: boolean | null
          mime_type?: string | null
          original_filename?: string | null
          photo_type?: string | null
          quality_issues?: string[] | null
          quality_score?: number | null
          source?: string | null
          storage_path: string
          team_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          url: string
          user_id: string
          vehicle_id: string
          width?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          analyzed_at?: string | null
          created_at?: string | null
          detected_angle?: string | null
          display_order?: number | null
          enhanced_at?: string | null
          enhanced_url?: string | null
          enhancement_settings?: Json | null
          file_size_bytes?: number | null
          generation_prompt?: string | null
          height?: number | null
          id?: string
          is_enhanced?: boolean | null
          is_vehicle_confirmed?: boolean | null
          is_visible?: boolean | null
          mime_type?: string | null
          original_filename?: string | null
          photo_type?: string | null
          quality_issues?: string[] | null
          quality_score?: number | null
          source?: string | null
          storage_path?: string
          team_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          url?: string
          user_id?: string
          vehicle_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string
          due_at: string | null
          id: string
          location_id: string | null
          notes: string | null
          priority: string
          status: string
          task_type: string
          team_id: string | null
          title: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by: string
          due_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          priority?: string
          status?: string
          task_type: string
          team_id?: string | null
          title: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string
          due_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          priority?: string
          status?: string
          task_type?: string
          team_id?: string | null
          title?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tasks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_tasks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_transfers: {
        Row: {
          from_location_id: string | null
          id: string
          notes: string | null
          odometer_reading: number | null
          reason: string | null
          to_location_id: string
          transferred_at: string | null
          transferred_by: string
          vehicle_id: string
        }
        Insert: {
          from_location_id?: string | null
          id?: string
          notes?: string | null
          odometer_reading?: number | null
          reason?: string | null
          to_location_id: string
          transferred_at?: string | null
          transferred_by: string
          vehicle_id: string
        }
        Update: {
          from_location_id?: string | null
          id?: string
          notes?: string | null
          odometer_reading?: number | null
          reason?: string | null
          to_location_id?: string
          transferred_at?: string | null
          transferred_by?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_transfers_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_transfers_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_transfers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string | null
          current_rate: number
          default_mileage_limit: number | null
          id: string
          image_url: string | null
          last_known_name: string | null
          last_ops_update: string | null
          license_plate: string | null
          location: string | null
          location_id: string | null
          make: string
          marketplace_visible: boolean
          mileage: number | null
          mileage_overage_rate: number | null
          model: string
          name: string
          ops_status: string | null
          ownership_type: string
          partner_id: string | null
          purge_at: string | null
          rate_3hr: number | null
          rate_6hr: number | null
          rate_multiday: number | null
          revenue: number | null
          slug: string | null
          split_type: string | null
          split_value: number | null
          status: string | null
          suggested_rate: number | null
          team_id: string | null
          trashed_at: string | null
          updated_at: string | null
          user_id: string
          utilization: number | null
          vin: string | null
          year: number | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          current_rate?: number
          default_mileage_limit?: number | null
          id?: string
          image_url?: string | null
          last_known_name?: string | null
          last_ops_update?: string | null
          license_plate?: string | null
          location?: string | null
          location_id?: string | null
          make: string
          marketplace_visible?: boolean
          mileage?: number | null
          mileage_overage_rate?: number | null
          model: string
          name: string
          ops_status?: string | null
          ownership_type?: string
          partner_id?: string | null
          purge_at?: string | null
          rate_3hr?: number | null
          rate_6hr?: number | null
          rate_multiday?: number | null
          revenue?: number | null
          slug?: string | null
          split_type?: string | null
          split_value?: number | null
          status?: string | null
          suggested_rate?: number | null
          team_id?: string | null
          trashed_at?: string | null
          updated_at?: string | null
          user_id: string
          utilization?: number | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          current_rate?: number
          default_mileage_limit?: number | null
          id?: string
          image_url?: string | null
          last_known_name?: string | null
          last_ops_update?: string | null
          license_plate?: string | null
          location?: string | null
          location_id?: string | null
          make?: string
          marketplace_visible?: boolean
          mileage?: number | null
          mileage_overage_rate?: number | null
          model?: string
          name?: string
          ops_status?: string | null
          ownership_type?: string
          partner_id?: string | null
          purge_at?: string | null
          rate_3hr?: number | null
          rate_6hr?: number | null
          rate_multiday?: number | null
          revenue?: number | null
          slug?: string | null
          split_type?: string | null
          split_value?: number | null
          status?: string | null
          suggested_rate?: number | null
          team_id?: string | null
          trashed_at?: string | null
          updated_at?: string | null
          user_id?: string
          utilization?: number | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vehicle_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_digests: {
        Row: {
          bookings_count: number | null
          created_at: string
          id: string
          revenue_total: number | null
          summary_json: Json
          team_id: string | null
          top_insight: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          bookings_count?: number | null
          created_at?: string
          id?: string
          revenue_total?: number | null
          summary_json?: Json
          team_id?: string | null
          top_insight?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          bookings_count?: number | null
          created_at?: string
          id?: string
          revenue_total?: number | null
          summary_json?: Json
          team_id?: string | null
          top_insight?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_digests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_events: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          work_order_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          work_order_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          due_at: string | null
          estimate_cost: number | null
          expected_return_at: string | null
          id: string
          internal_or_outsourced: string | null
          issue_type: string
          location_id: string | null
          notes: string | null
          out_of_rotation: boolean | null
          priority: string
          resolution_summary: string | null
          source: string
          source_id: string | null
          status: string
          team_id: string
          title: string
          updated_at: string | null
          vehicle_id: string
          vendor_name: string | null
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          due_at?: string | null
          estimate_cost?: number | null
          expected_return_at?: string | null
          id?: string
          internal_or_outsourced?: string | null
          issue_type?: string
          location_id?: string | null
          notes?: string | null
          out_of_rotation?: boolean | null
          priority?: string
          resolution_summary?: string | null
          source?: string
          source_id?: string | null
          status?: string
          team_id: string
          title: string
          updated_at?: string | null
          vehicle_id: string
          vendor_name?: string | null
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          due_at?: string | null
          estimate_cost?: number | null
          expected_return_at?: string | null
          id?: string
          internal_or_outsourced?: string | null
          issue_type?: string
          location_id?: string | null
          notes?: string | null
          out_of_rotation?: boolean | null
          priority?: string
          resolution_summary?: string | null
          source?: string
          source_id?: string | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string | null
          vehicle_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      booking_payment_summary: {
        Row: {
          booking_id: string | null
          collected: number | null
          gross_value: number | null
          outstanding: number | null
          platform_fee_amount: number | null
          refunded: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_ledger: {
        Row: {
          booking_id: string | null
          booking_status: string | null
          customer_name: string | null
          deposit_held: number | null
          end_date: string | null
          security_deposit_status: string | null
          start_date: string | null
          team_id: string | null
        }
        Insert: {
          booking_id?: string | null
          booking_status?: string | null
          customer_name?: string | null
          deposit_held?: number | null
          end_date?: string | null
          security_deposit_status?: string | null
          start_date?: string | null
          team_id?: string | null
        }
        Update: {
          booking_id?: string | null
          booking_status?: string | null
          customer_name?: string | null
          deposit_held?: number | null
          end_date?: string | null
          security_deposit_status?: string | null
          start_date?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_by_source: {
        Row: {
          booking_count: number | null
          booking_source: string | null
          gross_revenue: number | null
          month_bucket: string | null
          net_revenue: number | null
          platform_fees: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photos_with_vehicle: {
        Row: {
          ai_analysis: Json | null
          analyzed_at: string | null
          created_at: string | null
          detected_angle: string | null
          display_order: number | null
          enhanced_at: string | null
          enhanced_url: string | null
          enhancement_settings: Json | null
          file_size_bytes: number | null
          height: number | null
          id: string | null
          is_enhanced: boolean | null
          is_vehicle_confirmed: boolean | null
          is_visible: boolean | null
          mime_type: string | null
          original_filename: string | null
          photo_type: string | null
          quality_issues: string[] | null
          quality_score: number | null
          storage_path: string | null
          team_id: string | null
          thumbnail_url: string | null
          updated_at: string | null
          url: string | null
          user_id: string | null
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_name: string | null
          vehicle_plate: string | null
          vehicle_year: number | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      auto_clear_billing_dunning_for_email: {
        Args: { p_email: string }
        Returns: undefined
      }
      auto_purge_expired_vehicles: { Args: never; Returns: number }
      can_access_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_entity: {
        Args: { _entity_id: string; _entity_type: string; _user_id: string }
        Returns: boolean
      }
      can_access_location: {
        Args: { _location_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_realtime_topic: {
        Args: { _topic: string; _user_id: string }
        Returns: boolean
      }
      can_manage_team_groups: { Args: { _team_id: string }; Returns: boolean }
      can_manage_team_or_user_storage_path: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      can_read_message_attachment_path: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      can_read_team_or_user_storage_path: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      can_write_message_attachment_path: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      can_write_team_or_user_storage_path: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      clear_billing_dunning: {
        Args: { p_note?: string; p_team_id: string }
        Returns: undefined
      }
      compute_rental_base: {
        Args: {
          p_daily_rate: number
          p_duration_type: string
          p_end: string
          p_start: string
        }
        Returns: number
      }
      count_admins: { Args: never; Returns: number }
      deactivate_team_member:
        | {
            Args: {
              p_deactivated_by: string
              p_reason?: string
              p_team_id: string
              p_user_id: string
            }
            Returns: boolean
          }
        | {
            Args: { reason?: string; target_user_id: string }
            Returns: undefined
          }
      fn_transition_payout: {
        Args: {
          p_action: string
          p_method?: string
          p_paid_at?: string
          p_payout_id: string
          p_reason?: string
          p_reference?: string
        }
        Returns: {
          booking_id: string
          created_at: string
          currency: string
          gross_rental_base: number
          id: string
          net_after_fee: number
          net_to_partner: number
          notes: string | null
          operator_adjustments: number
          paid_at: string | null
          partner_id: string
          payout_method: string | null
          payout_reference: string | null
          platform_fee_amount: number
          reconcile_flag: boolean
          reconcile_note: string | null
          split_type: string
          split_value_snapshot: number
          status: string
          team_id: string
          updated_at: string
          vehicle_id: string
          void_reason: string | null
          voided_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partner_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_vehicle_pnl: {
        Args: { p_end: string; p_start: string; p_team_id: string }
        Returns: {
          booking_count: number
          gross_revenue: number
          margin_pct: number
          net_revenue: number
          operator_net: number
          partner_payouts: number
          platform_fees: number
          total_expenses: number
          vehicle_id: string
          vehicle_name: string
        }[]
      }
      generate_recurring_expenses: { Args: never; Returns: number }
      get_customer_full: {
        Args: { p_customer_id: string }
        Returns: {
          address: string | null
          blacklist_reason: string | null
          created_at: string | null
          customer_status: string | null
          date_of_birth: string | null
          drivers_license: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          id_document_url: string | null
          id_verified: boolean | null
          id_verified_at: string | null
          insurance_document_url: string | null
          insurance_expiry: string | null
          insurance_policy: string | null
          insurance_provider: string | null
          insurance_verified: boolean | null
          insurance_verified_at: string | null
          license_expiry: string | null
          lifetime_value: number | null
          notes: string | null
          phone: string | null
          preferences: Json | null
          secondary_phone: string | null
          stripe_customer_id: string | null
          tags: string[] | null
          team_id: string | null
          total_bookings: number | null
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_document: {
        Args: { p_document_id: string }
        Returns: {
          billing_frequency: string | null
          booking_id: string | null
          created_at: string | null
          customer_id: string | null
          doc_ref: string | null
          email_sent_at: string | null
          expires_at: string | null
          file_size: number | null
          file_url: string
          id: string
          is_default: boolean | null
          name: string
          parent_document_id: string | null
          premium_amount: number | null
          signature_image_url: string | null
          signed_at: string | null
          signed_by_name: string | null
          signing_metadata: Json | null
          status: string | null
          team_id: string | null
          type: string
          updated_at: string | null
          user_id: string
          vehicle_id: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_inspection_photo_meta: {
        Args: { p_photo_id: string }
        Returns: {
          captured_at: string | null
          description: string | null
          id: string
          inspection_id: string
          photo_role: string | null
          photo_type: string | null
          photo_url: string
          quality_warning: boolean | null
          skipped: boolean | null
          uploaded_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "inspection_photos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_role: {
        Args: never
        Returns: {
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_rari_message: {
        Args: { p_message_id: string }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          entities: Json | null
          id: string
          role: string
        }[]
        SetofOptions: {
          from: "*"
          to: "rari_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_super_admin_audit_logs: {
        Args: never
        Returns: {
          action: string
          changed_by: string
          created_at: string
          id: string
          metadata: Json
          user_id: string
        }[]
      }
      get_super_admin_billing_tenants: {
        Args: never
        Returns: {
          assumed_plan_fleet_size: number
          assumed_plan_is_annual: boolean
          assumed_plan_tier: string
          billing_dunning_message: string
          billing_dunning_notes: string
          billing_dunning_set_at: string
          billing_dunning_stage: string
          id: string
          is_demo_account: boolean
          name: string
          owner_email: string
        }[]
      }
      get_super_admin_customers: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
        }[]
      }
      get_super_admin_platform_pulse: {
        Args: never
        Returns: {
          accounts_over_plan: number
          active_rentals_now: number
          failed_payments_7d: number
          revenue_7d: number
          revenue_sparkline: Json
          stuck_onboarding: number
          trials_ending_7d: number
        }[]
      }
      get_super_admin_stats: {
        Args: never
        Returns: {
          new_this_week: number
          total_bookings: number
          total_customers: number
          total_vehicles: number
        }[]
      }
      get_super_admin_tenant_detail: {
        Args: { p_team_id: string }
        Returns: Json
      }
      get_super_admin_tenant_health: {
        Args: never
        Returns: {
          active_rentals: number
          city: string
          fleet_size_cap: number
          is_demo: boolean
          last_activity: string
          plan_tier: string
          revenue_30d: number
          risk_flags: string[]
          stripe_connected: boolean
          team_id: string
          team_name: string
          trial_end: string
          util_30d: number
          vehicles_in_use: number
        }[]
      }
      get_super_admin_vehicle_audit: {
        Args: never
        Returns: {
          fleet_size_cap: number
          is_demo: boolean
          overage: number
          plan_tier: string
          seat_audit_reviewed_at: string
          team_id: string
          team_name: string
          trial_end: string
          vehicles_in_use: number
        }[]
      }
      get_team_owner: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_teams: { Args: { _user_id: string }; Returns: string[] }
      get_vehicle_hero_photo: {
        Args: { p_vehicle_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shared_team_role: {
        Args: {
          _actor_user_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _target_user_id: string
        }
        Returns: boolean
      }
      has_team_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _team_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_over_user: {
        Args: { _actor: string; _target: string }
        Returns: boolean
      }
      is_company_wide_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_conversation_creator: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_manager_over_user: {
        Args: { _actor: string; _target: string }
        Returns: boolean
      }
      is_marketplace_team: { Args: { _team_id: string }; Returns: boolean }
      is_marketplace_vehicle: {
        Args: { _vehicle_id: string }
        Returns: boolean
      }
      is_my_team_admin: { Args: { p_team_id: string }; Returns: boolean }
      is_my_team_member: { Args: { p_team_id: string }; Returns: boolean }
      is_same_team: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { check_user_id?: string }; Returns: boolean }
      is_team_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member:
        | { Args: { _team_id: string }; Returns: boolean }
        | { Args: { _team_id: string; _user_id: string }; Returns: boolean }
      is_team_member_of_record: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      log_admin_action: {
        Args: { p_action: string; p_details?: Json }
        Returns: string
      }
      log_pii_read: {
        Args: { p_entity: string; p_fields?: string[]; p_record_id: string }
        Returns: undefined
      }
      log_user_activity: {
        Args: {
          p_activity_type: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
        }
        Returns: string
      }
      lovable_rollback_snapshot: {
        Args: never
        Returns: {
          captured_at: string
          datname: string
          rollback_ratio: number
          xact_commit: number
          xact_rollback: number
        }[]
      }
      lovable_table_churn_snapshot: {
        Args: never
        Returns: {
          idx_scan: number
          n_dead_tup: number
          n_live_tup: number
          n_tup_del: number
          n_tup_ins: number
          n_tup_upd: number
          relname: string
          schemaname: string
          seq_scan: number
        }[]
      }
      mark_expired_invitations: { Args: never; Returns: undefined }
      mark_tenant_seat_review: {
        Args: { p_note?: string; p_team_id: string }
        Returns: undefined
      }
      migrate_users_to_teams: {
        Args: never
        Returns: {
          locations_created: number
          teams_created: number
          users_migrated: number
        }[]
      }
      next_invoice_number: { Args: { p_team_id: string }; Returns: string }
      public_team_by_slug: {
        Args: { _team_slug: string }
        Returns: {
          city: string
          currency: string
          logo_url: string
          name: string
          public_description: string
          slug: string
          state: string
          timezone: string
        }[]
      }
      public_team_fleet: {
        Args: { _team_slug: string }
        Returns: {
          color: string
          daily_rate: number
          hero_image_url: string
          make: string
          min_rental_days: number
          model: string
          name: string
          vehicle_slug: string
          year: number
        }[]
      }
      public_vehicle_availability: {
        Args: {
          _range_end: string
          _range_start: string
          _team_slug: string
          _vehicle_slug: string
        }
        Returns: {
          busy_end: string
          busy_start: string
        }[]
      }
      public_vehicle_by_slug: {
        Args: { _team_slug: string; _vehicle_slug: string }
        Returns: {
          color: string
          currency: string
          daily_rate: number
          default_mileage_limit: number
          hero_image_url: string
          make: string
          mileage_overage_rate: number
          model: string
          name: string
          photos: Json
          pickup_city: string
          pickup_state: string
          rate_3hr: number
          rate_6hr: number
          rate_multiday: number
          team_name: string
          team_slug: string
          timezone: string
          vehicle_slug: string
          year: number
        }[]
      }
      public_vehicle_quote: {
        Args: {
          _end_date: string
          _options?: Json
          _start_date: string
          _team_slug: string
          _vehicle_slug: string
        }
        Returns: {
          currency: string
          daily_rate_cents: number
          exotiq_total_cents: number
          grand_total_cents: number
          operator_total_cents: number
          platform_fee_cents: number
          platform_fee_percent: number
          protection_daily_cents: number
          protection_tier: string
          protection_total_cents: number
          rental_days: number
          rental_subtotal_cents: number
        }[]
      }
      purge_old_notifications: { Args: never; Returns: undefined }
      purge_vehicle_now: { Args: { p_vehicle_id: string }; Returns: undefined }
      reactivate_team_member:
        | {
            Args: {
              p_new_role?: string
              p_reactivated_by: string
              p_team_id: string
              p_user_id: string
            }
            Returns: boolean
          }
        | { Args: { target_user_id: string }; Returns: undefined }
      restore_vehicle_from_archive: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      restore_vehicle_from_trash: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      review_expense:
        | {
            Args: {
              p_action: string
              p_amount?: number
              p_booking_id?: string
              p_expense_date?: string
              p_expense_id: string
              p_expense_type?: string
              p_notes?: string
              p_vehicle_id?: string
              p_vendor?: string
            }
            Returns: {
              ai_confidence: number | null
              ai_parsed_fields: Json | null
              amount: number
              approval_threshold_applied: number | null
              auto_routed_reason: string | null
              booking_id: string | null
              created_at: string
              created_by: string | null
              currency: string
              expense_date: string
              expense_type: string
              id: string
              is_reimbursable: boolean
              linked_damage_claim_id: string | null
              location_id: string | null
              notes: string | null
              receipt_url: string | null
              reimbursed_amount: number
              requires_admin_approval: boolean
              review_reason: string | null
              reviewed_at: string | null
              reviewed_by: string | null
              source_module: string
              source_record_id: string | null
              status: string
              team_id: string
              updated_at: string
              vehicle_id: string | null
              vendor: string | null
            }
            SetofOptions: {
              from: "*"
              to: "vehicle_expenses"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_action: string
              p_amount?: number
              p_booking_id?: string
              p_expense_id: string
              p_expense_type?: string
              p_notes?: string
              p_vehicle_id?: string
            }
            Returns: {
              ai_confidence: number | null
              ai_parsed_fields: Json | null
              amount: number
              approval_threshold_applied: number | null
              auto_routed_reason: string | null
              booking_id: string | null
              created_at: string
              created_by: string | null
              currency: string
              expense_date: string
              expense_type: string
              id: string
              is_reimbursable: boolean
              linked_damage_claim_id: string | null
              location_id: string | null
              notes: string | null
              receipt_url: string | null
              reimbursed_amount: number
              requires_admin_approval: boolean
              review_reason: string | null
              reviewed_at: string | null
              reviewed_by: string | null
              source_module: string
              source_record_id: string | null
              status: string
              team_id: string
              updated_at: string
              vehicle_id: string | null
              vendor: string | null
            }
            SetofOptions: {
              from: "*"
              to: "vehicle_expenses"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      safe_uuid: { Args: { value: string }; Returns: string }
      set_billing_dunning_stage: {
        Args: {
          p_assumed_plan_fleet_size?: number
          p_assumed_plan_is_annual?: boolean
          p_assumed_plan_tier?: string
          p_message?: string
          p_notes?: string
          p_stage: string
          p_team_id: string
        }
        Returns: undefined
      }
      slugify: { Args: { _input: string }; Returns: string }
      snapshot_vehicle_billing: { Args: never; Returns: undefined }
      super_admin_has_permission: {
        Args: { check_user_id?: string; permission_name: string }
        Returns: boolean
      }
      trash_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      update_document_status: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "operator" | "viewer"
      legal_document_type:
        | "terms"
        | "privacy"
        | "aup"
        | "dpa"
        | "order_form"
        | "sms"
        | "cookies"
        | "dmca"
        | "transfer_addendum"
      tenant_document_status: "sent" | "viewed" | "signed" | "voided"
      tenant_document_template: "order_form" | "addendum" | "custom"
      terms_acceptance_event:
        | "signup"
        | "reacceptance"
        | "terms_update"
        | "order_form"
        | "sms_opt_out"
      terms_acceptance_method: "checkbox_click" | "button_click"
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
      app_role: ["owner", "admin", "manager", "operator", "viewer"],
      legal_document_type: [
        "terms",
        "privacy",
        "aup",
        "dpa",
        "order_form",
        "sms",
        "cookies",
        "dmca",
        "transfer_addendum",
      ],
      tenant_document_status: ["sent", "viewed", "signed", "voided"],
      tenant_document_template: ["order_form", "addendum", "custom"],
      terms_acceptance_event: [
        "signup",
        "reacceptance",
        "terms_update",
        "order_form",
        "sms_opt_out",
      ],
      terms_acceptance_method: ["checkbox_click", "button_click"],
    },
  },
} as const
