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
            referencedRelation: "bookings"
            referencedColumns: ["id"]
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
      bookings: {
        Row: {
          balance_due: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          daily_rate: number
          delivery_address: string | null
          delivery_fee: number | null
          deposit_amount: number | null
          dropoff_location: string | null
          end_date: string
          id: string
          mileage_limit: number | null
          mileage_overage_fee: number | null
          notes: string | null
          payment_status: string | null
          pickup_fuel_level: number | null
          pickup_location: string
          pickup_odometer: number | null
          requires_delivery: boolean | null
          return_fuel_level: number | null
          return_odometer: number | null
          security_deposit_amount: number | null
          security_deposit_status: string | null
          start_date: string
          status: string | null
          total_value: number
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          balance_due?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          daily_rate: number
          delivery_address?: string | null
          delivery_fee?: number | null
          deposit_amount?: number | null
          dropoff_location?: string | null
          end_date: string
          id?: string
          mileage_limit?: number | null
          mileage_overage_fee?: number | null
          notes?: string | null
          payment_status?: string | null
          pickup_fuel_level?: number | null
          pickup_location: string
          pickup_odometer?: number | null
          requires_delivery?: boolean | null
          return_fuel_level?: number | null
          return_odometer?: number | null
          security_deposit_amount?: number | null
          security_deposit_status?: string | null
          start_date: string
          status?: string | null
          total_value: number
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          balance_due?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          daily_rate?: number
          delivery_address?: string | null
          delivery_fee?: number | null
          deposit_amount?: number | null
          dropoff_location?: string | null
          end_date?: string
          id?: string
          mileage_limit?: number | null
          mileage_overage_fee?: number | null
          notes?: string | null
          payment_status?: string | null
          pickup_fuel_level?: number | null
          pickup_location?: string
          pickup_odometer?: number | null
          requires_delivery?: boolean | null
          return_fuel_level?: number | null
          return_odometer?: number | null
          security_deposit_amount?: number | null
          security_deposit_status?: string | null
          start_date?: string
          status?: string | null
          total_value?: number
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
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
      customer_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          note: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
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
          stripe_customer_id: string | null
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
          stripe_customer_id?: string | null
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
          stripe_customer_id?: string | null
          total_bookings?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
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
          updated_at?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_claims_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
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
      documents: {
        Row: {
          created_at: string | null
          customer_id: string | null
          expires_at: string | null
          file_size: number | null
          file_url: string
          id: string
          name: string
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
          vehicle_id: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          name: string
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          vehicle_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          name?: string
          status?: string | null
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
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      inspection_photos: {
        Row: {
          description: string | null
          id: string
          inspection_id: string
          photo_type: string | null
          photo_url: string
          uploaded_at: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          inspection_id: string
          photo_type?: string | null
          photo_url: string
          uploaded_at?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          inspection_id?: string
          photo_type?: string | null
          photo_url?: string
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
      maintenance_schedules: {
        Row: {
          created_at: string
          estimated_cost: number | null
          id: string
          maintenance_type: string
          notes: string | null
          scheduled_date: string
          service_provider: string | null
          status: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          maintenance_type: string
          notes?: string | null
          scheduled_date: string
          service_provider?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          maintenance_type?: string
          notes?: string | null
          scheduled_date?: string
          service_provider?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
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
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
          id: string
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          payment_type: string
          stripe_payment_intent_id: string | null
          transaction_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_type: string
          stripe_payment_intent_id?: string | null
          transaction_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_type?: string
          stripe_payment_intent_id?: string | null
          transaction_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          phone?: string | null
          updated_at?: string | null
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
          user_id?: string
        }
        Relationships: []
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
          token?: string
        }
        Relationships: []
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
      vehicle_inspections: {
        Row: {
          booking_id: string | null
          created_at: string | null
          exterior_condition: string | null
          fuel_level: number
          id: string
          inspection_type: string
          inspector_name: string | null
          interior_condition: string | null
          notes: string | null
          odometer_reading: number
          tire_condition: string | null
          updated_at: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          exterior_condition?: string | null
          fuel_level: number
          id?: string
          inspection_type: string
          inspector_name?: string | null
          interior_condition?: string | null
          notes?: string | null
          odometer_reading: number
          tire_condition?: string | null
          updated_at?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          exterior_condition?: string | null
          fuel_level?: number
          id?: string
          inspection_type?: string
          inspector_name?: string | null
          interior_condition?: string | null
          notes?: string | null
          odometer_reading?: number
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
            referencedRelation: "bookings"
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
      vehicles: {
        Row: {
          created_at: string | null
          current_rate: number
          id: string
          image_url: string | null
          license_plate: string | null
          make: string
          model: string
          name: string
          revenue: number | null
          status: string | null
          suggested_rate: number | null
          updated_at: string | null
          user_id: string
          utilization: number | null
          vin: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          current_rate?: number
          id?: string
          image_url?: string | null
          license_plate?: string | null
          make: string
          model: string
          name: string
          revenue?: number | null
          status?: string | null
          suggested_rate?: number | null
          updated_at?: string | null
          user_id: string
          utilization?: number | null
          vin?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          current_rate?: number
          id?: string
          image_url?: string | null
          license_plate?: string | null
          make?: string
          model?: string
          name?: string
          revenue?: number | null
          status?: string | null
          suggested_rate?: number | null
          updated_at?: string | null
          user_id?: string
          utilization?: number | null
          vin?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_admins: { Args: never; Returns: number }
      get_my_role: {
        Args: never
        Returns: {
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_expired_invitations: { Args: never; Returns: undefined }
      update_document_status: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "manager" | "operator" | "viewer"
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
      app_role: ["admin", "manager", "operator", "viewer"],
    },
  },
} as const
