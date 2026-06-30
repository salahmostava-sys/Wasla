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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      account_assignments: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string | null
          id: string
          month_year: string
          notes: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          month_year: string
          notes?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          month_year?: string
          notes?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_assignments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "platform_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_action_log: {
        Row: {
          action: string
          created_at: string
          id: string
          meta: Json
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          meta?: Json
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          meta?: Json
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      advance_installments: {
        Row: {
          advance_id: string
          amount: number
          created_by: string | null
          deducted_at: string | null
          id: string
          month_year: string
          notes: string | null
          status: Database["public"]["Enums"]["installment_status"]
          updated_by: string | null
        }
        Insert: {
          advance_id: string
          amount: number
          created_by?: string | null
          deducted_at?: string | null
          id?: string
          month_year: string
          notes?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_by?: string | null
        }
        Update: {
          advance_id?: string
          amount?: number
          created_by?: string | null
          deducted_at?: string | null
          id?: string
          month_year?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["installment_status"]
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advance_installments_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
        ]
      }
      advances: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          created_by: string | null
          disbursement_date: string
          employee_id: string
          first_deduction_month: string
          id: string
          is_written_off: boolean
          monthly_amount: number
          note: string | null
          status: Database["public"]["Enums"]["advance_status"]
          total_installments: number
          updated_at: string
          updated_by: string | null
          written_off_at: string | null
          written_off_reason: string | null
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          disbursement_date?: string
          employee_id: string
          first_deduction_month: string
          id?: string
          is_written_off?: boolean
          monthly_amount: number
          note?: string | null
          status?: Database["public"]["Enums"]["advance_status"]
          total_installments?: number
          updated_at?: string
          updated_by?: string | null
          written_off_at?: string | null
          written_off_reason?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          disbursement_date?: string
          employee_id?: string
          first_deduction_month?: string
          id?: string
          is_written_off?: boolean
          monthly_amount?: number
          note?: string | null
          status?: Database["public"]["Enums"]["advance_status"]
          total_installments?: number
          updated_at?: string
          updated_by?: string | null
          written_off_at?: string | null
          written_off_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          details: Json | null
          due_date: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_resolved: boolean
          message: string | null
          resolved_by: string | null
          type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean
          message?: string | null
          resolved_by?: string | null
          type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean
          message?: string | null
          resolved_by?: string | null
          type?: string
        }
        Relationships: []
      }
      app_hybrid_rules: {
        Row: {
          app_id: string
          created_at: string | null
          fallback_to_orders: boolean | null
          id: string
          min_hours_for_shift: number
          shift_rate: number
          updated_at: string | null
        }
        Insert: {
          app_id: string
          created_at?: string | null
          fallback_to_orders?: boolean | null
          id?: string
          min_hours_for_shift: number
          shift_rate: number
          updated_at?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string | null
          fallback_to_orders?: boolean | null
          id?: string
          min_hours_for_shift?: number
          shift_rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_hybrid_rules_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: true
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_targets: {
        Row: {
          app_id: string
          created_at: string
          id: string
          month_year: string
          target_orders: number
          updated_at: string
        }
        Insert: {
          app_id: string
          created_at?: string
          id?: string
          month_year: string
          target_orders?: number
          updated_at?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          id?: string
          month_year?: string
          target_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_targets_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      apps: {
        Row: {
          brand_color: string
          created_at: string
          custom_columns: Json | null
          id: string
          is_active: boolean
          is_archived: boolean
          logo_url: string | null
          name: string
          name_en: string | null
          scheme_id: string | null
          text_color: string
          work_type: string | null
        }
        Insert: {
          brand_color?: string
          created_at?: string
          custom_columns?: Json | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          name_en?: string | null
          scheme_id?: string | null
          text_color?: string
          work_type?: string | null
        }
        Update: {
          brand_color?: string
          created_at?: string
          custom_columns?: Json | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          name_en?: string | null
          scheme_id?: string | null
          text_color?: string
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apps_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "salary_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          created_by: string | null
          date: string
          early_leave: boolean
          employee_id: string
          id: string
          late: boolean
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_by: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          early_leave?: boolean
          employee_id: string
          id?: string
          late?: boolean
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_by?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          early_leave?: boolean
          employee_id?: string
          id?: string
          late?: boolean
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_status_configs: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      commercial_records: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_orders: {
        Row: {
          app_id: string
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          id: string
          import_batch_id: string | null
          orders_count: number
          source: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_id: string
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          import_batch_id?: string | null
          orders_count?: number
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          import_batch_id?: string | null
          orders_count?: number
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "order_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_shifts: {
        Row: {
          app_id: string
          created_at: string | null
          date: string
          employee_id: string
          hours_worked: number
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          app_id: string
          created_at?: string | null
          date: string
          employee_id: string
          hours_worked: number
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          app_id?: string
          created_at?: string | null
          date?: string
          employee_id?: string
          hours_worked?: number
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_shifts_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          name: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      edge_rate_limits: {
        Row: {
          key: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          key: string
          request_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          key?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      employee_apps: {
        Row: {
          app_id: string
          employee_id: string
          id: string
          joined_date: string | null
          status: string
          username: string | null
        }
        Insert: {
          app_id: string
          employee_id: string
          id?: string
          joined_date?: string | null
          status?: string
          username?: string | null
        }
        Update: {
          app_id?: string
          employee_id?: string
          id?: string
          joined_date?: string | null
          status?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_apps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          employee_id: string
          id: string
          is_primary: boolean
          role_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id: string
          id?: string
          is_primary?: boolean
          role_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id?: string
          id?: string
          is_primary?: boolean
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_scheme: {
        Row: {
          assigned_by: string | null
          assigned_date: string
          employee_id: string
          id: string
          scheme_id: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_date?: string
          employee_id: string
          id?: string
          scheme_id: string
        }
        Update: {
          assigned_by?: string | null
          assigned_date?: string
          employee_id?: string
          id?: string
          scheme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_scheme_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_scheme_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "salary_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_targets: {
        Row: {
          created_at: string
          created_by: string | null
          daily_target_orders: number
          employee_id: string
          id: string
          month_year: string
          monthly_target_orders: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_target_orders?: number
          employee_id: string
          id?: string
          month_year: string
          monthly_target_orders?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_target_orders?: number
          employee_id?: string
          id?: string
          month_year?: string
          monthly_target_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_targets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_tiers: {
        Row: {
          app_ids: Json
          created_at: string
          delivery_status: string
          employee_id: string
          id: string
          notes: string | null
          package_type: string
          renewal_date: string
          sim_number: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          app_ids?: Json
          created_at?: string
          delivery_status?: string
          employee_id: string
          id?: string
          notes?: string | null
          package_type?: string
          renewal_date: string
          sim_number?: string | null
          start_date?: string
          updated_at?: string
        }
        Update: {
          app_ids?: Json
          created_at?: string
          delivery_status?: string
          employee_id?: string
          id?: string
          notes?: string | null
          package_type?: string
          renewal_date?: string
          sim_number?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_tiers_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          allowances: Json | null
          bank_account_number: string | null
          base_salary: number
          birth_date: string | null
          cities: string[] | null
          city: string | null
          commercial_record: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          dob: string | null
          email: string | null
          health_insurance_expiry: string | null
          iban: string | null
          id: string
          id_photo_url: string | null
          iqama_photo_url: string | null
          is_sponsored: boolean
          job_title: string | null
          join_date: string | null
          license_expiry: string | null
          license_has: boolean
          license_photo_url: string | null
          license_status:
            | Database["public"]["Enums"]["license_status_enum"]
            | null
          name: string
          name_en: string | null
          national_id: string | null
          nationality: string | null
          personal_photo_url: string | null
          phone: string | null
          position_id: string | null
          preferred_language: string
          probation_end_date: string | null
          residency_expiry: string | null
          role_id: string | null
          salary_type: Database["public"]["Enums"]["salary_type"]
          sponsorship_status:
            | Database["public"]["Enums"]["sponsorship_status_enum"]
            | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowances?: Json | null
          bank_account_number?: string | null
          base_salary?: number
          birth_date?: string | null
          cities?: string[] | null
          city?: string | null
          commercial_record?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          dob?: string | null
          email?: string | null
          health_insurance_expiry?: string | null
          iban?: string | null
          id?: string
          id_photo_url?: string | null
          iqama_photo_url?: string | null
          is_sponsored?: boolean
          job_title?: string | null
          join_date?: string | null
          license_expiry?: string | null
          license_has?: boolean
          license_photo_url?: string | null
          license_status?:
            | Database["public"]["Enums"]["license_status_enum"]
            | null
          name: string
          name_en?: string | null
          national_id?: string | null
          nationality?: string | null
          personal_photo_url?: string | null
          phone?: string | null
          position_id?: string | null
          preferred_language?: string
          probation_end_date?: string | null
          residency_expiry?: string | null
          role_id?: string | null
          salary_type?: Database["public"]["Enums"]["salary_type"]
          sponsorship_status?:
            | Database["public"]["Enums"]["sponsorship_status_enum"]
            | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowances?: Json | null
          bank_account_number?: string | null
          base_salary?: number
          birth_date?: string | null
          cities?: string[] | null
          city?: string | null
          commercial_record?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          dob?: string | null
          email?: string | null
          health_insurance_expiry?: string | null
          iban?: string | null
          id?: string
          id_photo_url?: string | null
          iqama_photo_url?: string | null
          is_sponsored?: boolean
          job_title?: string | null
          join_date?: string | null
          license_expiry?: string | null
          license_has?: boolean
          license_photo_url?: string | null
          license_status?:
            | Database["public"]["Enums"]["license_status_enum"]
            | null
          name?: string
          name_en?: string | null
          national_id?: string | null
          nationality?: string | null
          personal_photo_url?: string | null
          phone?: string | null
          position_id?: string | null
          preferred_language?: string
          probation_end_date?: string | null
          residency_expiry?: string | null
          role_id?: string | null
          salary_type?: Database["public"]["Enums"]["salary_type"]
          sponsorship_status?:
            | Database["public"]["Enums"]["sponsorship_status_enum"]
            | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_deductions: {
        Row: {
          amount: number
          apply_month: string
          approval_status: Database["public"]["Enums"]["approval_status"]
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          incident_date: string | null
          linked_advance_id: string | null
          note: string | null
          source_app_id: string | null
          type: Database["public"]["Enums"]["deduction_type"]
          updated_by: string | null
        }
        Insert: {
          amount: number
          apply_month: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          incident_date?: string | null
          linked_advance_id?: string | null
          note?: string | null
          source_app_id?: string | null
          type?: Database["public"]["Enums"]["deduction_type"]
          updated_by?: string | null
        }
        Update: {
          amount?: number
          apply_month?: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          incident_date?: string | null
          linked_advance_id?: string | null
          note?: string | null
          source_app_id?: string | null
          type?: Database["public"]["Enums"]["deduction_type"]
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_deductions_linked_advance_id_fkey"
            columns: ["linked_advance_id"]
            isOneToOne: false
            referencedRelation: "advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_deductions_source_app_id_fkey"
            columns: ["source_app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_auto: boolean
          month_year: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_auto?: boolean
          month_year: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_auto?: boolean
          month_year?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      locked_months: {
        Row: {
          id: string
          locked_at: string
          locked_by: string | null
          month_year: string
        }
        Insert: {
          id?: string
          locked_at?: string
          locked_by?: string | null
          month_year: string
        }
        Update: {
          id?: string
          locked_at?: string
          locked_by?: string | null
          month_year?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          employee_id: string | null
          id: string
          maintenance_date: string
          notes: string | null
          odometer_reading: number | null
          paid_by: string | null
          status: string | null
          total_cost: number
          type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          maintenance_date: string
          notes?: string | null
          odometer_reading?: number | null
          paid_by?: string | null
          status?: string | null
          total_cost?: number
          type?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          maintenance_date?: string
          notes?: string | null
          odometer_reading?: number | null
          paid_by?: string | null
          status?: string | null
          total_cost?: number
          type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_parts: {
        Row: {
          cost_at_time: number
          created_at: string
          id: string
          maintenance_log_id: string
          part_id: string
          quantity_used: number
        }
        Insert: {
          cost_at_time?: number
          created_at?: string
          id?: string
          maintenance_log_id: string
          part_id: string
          quantity_used: number
        }
        Update: {
          cost_at_time?: number
          created_at?: string
          id?: string
          maintenance_log_id?: string
          part_id?: string
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_parts_maintenance_log_id_fkey"
            columns: ["maintenance_log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          error_count: number
          error_summary: Json
          file_name: string | null
          id: string
          imported_rows: number
          meta: Json
          month_year: string
          skipped_rows: number
          source_type: string
          started_at: string
          started_by: string | null
          status: string
          target_app_id: string | null
          total_rows: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          error_summary?: Json
          file_name?: string | null
          id?: string
          imported_rows?: number
          meta?: Json
          month_year: string
          skipped_rows?: number
          source_type?: string
          started_at?: string
          started_by?: string | null
          status?: string
          target_app_id?: string | null
          total_rows?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          error_summary?: Json
          file_name?: string | null
          id?: string
          imported_rows?: number
          meta?: Json
          month_year?: string
          skipped_rows?: number
          source_type?: string
          started_at?: string
          started_by?: string | null
          status?: string
          target_app_id?: string | null
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_import_batches_target_app_id_fkey"
            columns: ["target_app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      pl_records: {
        Row: {
          cost_deductions: number
          cost_other: number
          cost_salaries: number
          cost_vehicles: number
          created_at: string
          created_by: string | null
          id: string
          month_year: string
          notes: string | null
          revenue_other: number
          revenue_riders: number
          updated_by: string | null
        }
        Insert: {
          cost_deductions?: number
          cost_other?: number
          cost_salaries?: number
          cost_vehicles?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_year: string
          notes?: string | null
          revenue_other?: number
          revenue_riders?: number
          updated_by?: string | null
        }
        Update: {
          cost_deductions?: number
          cost_other?: number
          cost_salaries?: number
          cost_vehicles?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_year?: string
          notes?: string | null
          revenue_other?: number
          revenue_riders?: number
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_accounts: {
        Row: {
          account_id_on_platform: string | null
          account_username: string
          app_id: string
          created_at: string
          employee_id: string | null
          id: string
          iqama_expiry_date: string | null
          iqama_number: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id_on_platform?: string | null
          account_username: string
          app_id: string
          created_at?: string
          employee_id?: string | null
          id?: string
          iqama_expiry_date?: string | null
          iqama_number?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id_on_platform?: string | null
          account_username?: string
          app_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          iqama_expiry_date?: string | null
          iqama_number?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_accounts_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          app_id: string
          bonus_amount: number | null
          bonus_target_orders: number | null
          created_at: string
          fixed_salary: number | null
          id: string
          is_active: boolean
          max_orders: number | null
          min_orders: number
          priority: number
          rate_per_order: number | null
          rule_type: string
          updated_at: string
        }
        Insert: {
          app_id: string
          bonus_amount?: number | null
          bonus_target_orders?: number | null
          created_at?: string
          fixed_salary?: number | null
          id?: string
          is_active?: boolean
          max_orders?: number | null
          min_orders?: number
          priority?: number
          rate_per_order?: number | null
          rule_type?: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          bonus_amount?: number | null
          bonus_target_orders?: number | null
          created_at?: string
          fixed_salary?: number | null
          id?: string
          is_active?: boolean
          max_orders?: number | null
          min_orders?: number
          priority?: number
          rate_per_order?: number | null
          rule_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string | null
          name_en: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          name?: string | null
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          permissions: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_drafts: {
        Row: {
          created_at: string
          draft_data: Json
          employee_id: string
          id: string
          month_year: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_data: Json
          employee_id: string
          id?: string
          month_year: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_data?: Json
          employee_id?: string
          id?: string
          month_year?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_drafts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_month_snapshots: {
        Row: {
          captured_at: string
          captured_by: string | null
          created_at: string
          id: string
          month_year: string
          snapshot: Json
          summary: Json
          updated_at: string
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          created_at?: string
          id?: string
          month_year: string
          snapshot?: Json
          summary?: Json
          updated_at?: string
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          created_at?: string
          id?: string
          month_year?: string
          snapshot?: Json
          summary?: Json
          updated_at?: string
        }
        Relationships: []
      }
      salary_records: {
        Row: {
          advance_deduction: number
          allowances: number
          approved_at: string | null
          approved_by: string | null
          attendance_deduction: number
          base_salary: number
          calc_source: string
          calc_status: string
          created_at: string
          created_by: string | null
          employee_id: string
          external_deduction: number
          id: string
          is_approved: boolean
          manual_deduction: number
          manual_deduction_note: string | null
          month_year: string
          net_salary: number
          payment_method: string
          sheet_snapshot: Json | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          advance_deduction?: number
          allowances?: number
          approved_at?: string | null
          approved_by?: string | null
          attendance_deduction?: number
          base_salary?: number
          calc_source?: string
          calc_status?: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          external_deduction?: number
          id?: string
          is_approved?: boolean
          manual_deduction?: number
          manual_deduction_note?: string | null
          month_year: string
          net_salary?: number
          payment_method?: string
          sheet_snapshot?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          advance_deduction?: number
          allowances?: number
          approved_at?: string | null
          approved_by?: string | null
          attendance_deduction?: number
          base_salary?: number
          calc_source?: string
          calc_status?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          external_deduction?: number
          id?: string
          is_approved?: boolean
          manual_deduction?: number
          manual_deduction_note?: string | null
          month_year?: string
          net_salary?: number
          payment_method?: string
          sheet_snapshot?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_scheme_tiers: {
        Row: {
          created_at: string
          from_orders: number
          id: string
          incremental_price: number | null
          incremental_threshold: number | null
          price_per_order: number
          scheme_id: string
          tier_order: number
          tier_type: string
          to_orders: number | null
        }
        Insert: {
          created_at?: string
          from_orders?: number
          id?: string
          incremental_price?: number | null
          incremental_threshold?: number | null
          price_per_order: number
          scheme_id: string
          tier_order?: number
          tier_type?: string
          to_orders?: number | null
        }
        Update: {
          created_at?: string
          from_orders?: number
          id?: string
          incremental_price?: number | null
          incremental_threshold?: number | null
          price_per_order?: number
          scheme_id?: string
          tier_order?: number
          tier_type?: string
          to_orders?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_scheme_tiers_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "salary_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_schemes: {
        Row: {
          created_at: string
          id: string
          monthly_amount: number | null
          name: string
          name_en: string | null
          scheme_type: string
          status: Database["public"]["Enums"]["scheme_status"]
          target_bonus: number | null
          target_orders: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_amount?: number | null
          name: string
          name_en?: string | null
          scheme_type?: string
          status?: Database["public"]["Enums"]["scheme_status"]
          target_bonus?: number | null
          target_orders?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_amount?: number | null
          name?: string
          name_en?: string | null
          scheme_type?: string
          status?: Database["public"]["Enums"]["scheme_status"]
          target_bonus?: number | null
          target_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      salary_slip_templates: {
        Row: {
          created_at: string
          created_by: string | null
          footer_html: string | null
          header_html: string | null
          id: string
          is_default: boolean
          name: string
          selected_columns: Json | null
          template_json: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_default?: boolean
          name: string
          selected_columns?: Json | null
          template_json?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          footer_html?: string | null
          header_html?: string | null
          id?: string
          is_default?: boolean
          name?: string
          selected_columns?: Json | null
          template_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_slip_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_tiers: {
        Row: {
          app_id: string
          created_at: string
          extra_rate: number | null
          fixed_amount: number | null
          id: string
          is_active: boolean
          max_orders: number | null
          min_orders: number
          priority: number
          rate_per_order: number | null
          tier_type: string
          updated_at: string
        }
        Insert: {
          app_id: string
          created_at?: string
          extra_rate?: number | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_orders?: number | null
          min_orders?: number
          priority?: number
          rate_per_order?: number | null
          tier_type?: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          created_at?: string
          extra_rate?: number | null
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_orders?: number | null
          min_orders?: number
          priority?: number
          rate_per_order?: number | null
          tier_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_tiers_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      scheme_month_snapshots: {
        Row: {
          created_at: string
          id: string
          month_year: string
          scheme_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          month_year: string
          scheme_id: string
          snapshot?: Json
        }
        Update: {
          created_at?: string
          id?: string
          month_year?: string
          scheme_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scheme_month_snapshots_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "salary_schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_parts: {
        Row: {
          created_at: string
          id: string
          min_stock_alert: number | null
          name_ar: string
          notes: string | null
          part_number: string | null
          stock_quantity: number
          supplier: string | null
          unit: string | null
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_stock_alert?: number | null
          name_ar: string
          notes?: string | null
          part_number?: string | null
          stock_quantity?: number
          supplier?: string | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_stock_alert?: number | null
          name_ar?: string
          notes?: string | null
          part_number?: string | null
          stock_quantity?: number
          supplier?: string | null
          unit?: string | null
          unit_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      supervisor_employee_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string | null
          id: string
          notes: string | null
          start_date: string
          supervisor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string
          supervisor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string
          supervisor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_employee_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_employee_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_employee_assignments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month_year: string
          notes: string | null
          supervisor_id: string
          target_orders: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month_year: string
          notes?: string | null
          supervisor_id: string
          target_orders?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month_year?: string
          notes?: string | null
          supervisor_id?: string
          target_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_targets_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          default_language: string
          id: string
          iqama_alert_days: number
          logo_url: string | null
          project_name_ar: string
          project_name_en: string
          project_subtitle_ar: string
          project_subtitle_en: string
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_language?: string
          id?: string
          iqama_alert_days?: number
          logo_url?: string | null
          project_name_ar?: string
          project_name_en?: string
          project_subtitle_ar?: string
          project_subtitle_en?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_language?: string
          id?: string
          iqama_alert_days?: number
          logo_url?: string | null
          project_name_ar?: string
          project_name_en?: string
          project_subtitle_ar?: string
          project_subtitle_en?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      trade_registers: {
        Row: {
          cr_number: string | null
          created_at: string
          id: string
          name: string
          name_en: string | null
          notes: string | null
        }
        Insert: {
          cr_number?: string | null
          created_at?: string
          id?: string
          name: string
          name_en?: string | null
          notes?: string | null
        }
        Update: {
          cr_number?: string | null
          created_at?: string
          id?: string
          name?: string
          name_en?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          permission_key: string
          user_id: string
        }
        Update: {
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string | null
          id: string
          notes: string | null
          reason: string | null
          returned_at: string | null
          start_at: string | null
          start_date: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          returned_at?: string | null
          start_at?: string | null
          start_date?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          returned_at?: string | null
          start_at?: string | null
          start_date?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_mileage: {
        Row: {
          cost_per_km: number | null
          created_at: string
          employee_id: string
          fuel_cost: number
          id: string
          km_total: number
          month_year: string
          notes: string | null
        }
        Insert: {
          cost_per_km?: number | null
          created_at?: string
          employee_id: string
          fuel_cost?: number
          id?: string
          km_total?: number
          month_year: string
          notes?: string | null
        }
        Update: {
          cost_per_km?: number | null
          created_at?: string
          employee_id?: string
          fuel_cost?: number
          id?: string
          km_total?: number
          month_year?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_mileage_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_mileage_daily: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          fuel_cost: number
          id: string
          km_total: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          fuel_cost?: number
          id?: string
          km_total?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          fuel_cost?: number
          id?: string
          km_total?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_mileage_daily_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          authorization_expiry: string | null
          brand: string | null
          chassis_number: string | null
          created_at: string
          has_fuel_chip: boolean
          id: string
          insurance_expiry: string | null
          model: string | null
          notes: string | null
          plate_number: string
          plate_number_en: string | null
          registration_expiry: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
          year: number | null
        }
        Insert: {
          authorization_expiry?: string | null
          brand?: string | null
          chassis_number?: string | null
          created_at?: string
          has_fuel_chip?: boolean
          id?: string
          insurance_expiry?: string | null
          model?: string | null
          notes?: string | null
          plate_number: string
          plate_number_en?: string | null
          registration_expiry?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          authorization_expiry?: string | null
          brand?: string | null
          chassis_number?: string | null
          created_at?: string
          has_fuel_chip?: boolean
          id?: string
          insurance_expiry?: string | null
          model?: string | null
          notes?: string | null
          plate_number?: string
          plate_number_en?: string | null
          registration_expiry?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      v_rider_daily_performance: {
        Row: {
          active_platforms: number | null
          city: string | null
          date: string | null
          employee_id: string | null
          employee_name: string | null
          platform_breakdown: Json | null
          total_orders: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rider_daily_platform_orders: {
        Row: {
          app_id: string | null
          app_name: string | null
          brand_color: string | null
          city: string | null
          date: string | null
          employee_id: string | null
          employee_name: string | null
          total_orders: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rider_monthly_performance: {
        Row: {
          active_days: number | null
          avg_orders_per_day: number | null
          best_day_orders: number | null
          city: string | null
          consistency_days: number | null
          consistency_ratio: number | null
          daily_target_orders: number | null
          employee_id: string | null
          employee_name: string | null
          last_active_date: string | null
          month_year: string | null
          monthly_target_orders: number | null
          target_achievement_pct: number | null
          total_orders: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      advance_in_my_company: { Args: { _advance_id: string }; Returns: boolean }
      calc_tier_salary: {
        Args: { p_orders: number; p_scheme_id?: string }
        Returns: number
      }
      calculate_employee_salary: {
        Args: {
          p_employee_id: string
          p_manual_deduction?: number
          p_manual_deduction_note?: string
          p_month_year: string
          p_payment_method?: string
        }
        Returns: {
          advance_deduction: number
          attendance_deduction: number
          base_salary: number
          employee_id: string
          employee_name: string
          external_deduction: number
          manual_deduction: number
          manual_deduction_note: string
          net_salary: number
          payment_method: string
          platform_breakdown: Json
          total_earnings: number
          total_orders: number
          total_shift_days: number
        }[]
      }
      calculate_order_salary_for_app: {
        Args: {
          p_allow_target_bonus?: boolean
          p_app_id: string
          p_attendance_days?: number
          p_fixed_scheme_ids?: string[]
          p_orders: number
        }
        Returns: {
          calculation_method: string
          earnings: number
          fixed_scheme_ids: string[]
        }[]
      }
      calculate_salary: {
        Args: {
          p_employee_id: string
          p_manual_deduction?: number
          p_manual_deduction_note?: string
          p_month_year: string
          p_payment_method?: string
        }
        Returns: {
          advance_deduction: number
          attendance_days: number
          attendance_deduction: number
          base_salary: number
          calc_status: string
          employee_id: string
          external_deduction: number
          manual_deduction: number
          month_year: string
          net_salary: number
          total_orders: number
        }[]
      }
      calculate_salary_for_employee_month: {
        Args: {
          p_employee_id: string
          p_manual_deduction?: number
          p_manual_deduction_note?: string
          p_month_year: string
          p_payment_method?: string
        }
        Returns: {
          out_advance_deduction: number
          out_attendance_deduction: number
          out_base_salary: number
          out_calc_status: string
          out_employee_id: string
          out_external_deduction: number
          out_manual_deduction: number
          out_month_year: string
          out_net_salary: number
          out_total_orders: number
          out_total_shift_days: number
        }[]
      }
      calculate_salary_for_month: {
        Args: { p_month_year: string; p_payment_method?: string }
        Returns: {
          advance_deduction: number
          attendance_deduction: number
          base_salary: number
          calc_status: string
          employee_id: string
          external_deduction: number
          manual_deduction: number
          month_year: string
          net_salary: number
          total_orders: number
          total_shift_days: number
        }[]
      }
      capture_salary_month_snapshot: {
        Args: { p_month_year: string }
        Returns: Json
      }
      check_employee_operational_records: {
        Args: { p_employee_id: string }
        Returns: boolean
      }
      check_in: {
        Args: { p_checkin_at?: string; p_employee_id: string }
        Returns: {
          check_in: string | null
          check_out: string | null
          created_at: string
          created_by: string | null
          date: string
          early_leave: boolean
          employee_id: string
          id: string
          late: boolean
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_out: {
        Args: { p_checkout_at?: string; p_employee_id: string }
        Returns: {
          check_in: string | null
          check_out: string | null
          created_at: string
          created_by: string | null
          date: string
          early_leave: boolean
          employee_id: string
          id: string
          late: boolean
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dashboard_overview:
        | {
            Args: {
              p_cip: string
              p_month: number
              p_today?: string
              p_year: number
            }
            Returns: Json
          }
        | {
            Args: { p_cip: string; p_monthly_year: string; p_today?: string }
            Returns: Json
          }
        | {
            Args: { p_month: number; p_today?: string; p_year: number }
            Returns: Json
          }
      dashboard_overview_rpc:
        | {
            Args: {
              p_cip: string
              p_month: number
              p_today?: string
              p_year: number
            }
            Returns: Json
          }
        | {
            Args: { p_cip: string; p_monthly_year: string; p_today?: string }
            Returns: Json
          }
        | {
            Args: { p_month: number; p_today?: string; p_year: number }
            Returns: Json
          }
        | { Args: { p_month_year: string; p_today?: string }; Returns: Json }
      employee_in_my_company: {
        Args: { _employee_id: string }
        Returns: boolean
      }
      enforce_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { p_action: string; p_resource: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_internal_user: { Args: never; Returns: boolean }
      is_salary_admin_job_title: {
        Args: { p_job_title: string }
        Returns: boolean
      }
      is_salary_month_visible_employee: {
        Args: {
          p_employee_id: string
          p_job_title: string
          p_month_year: string
          p_sponsorship_status: string
          p_status: string
        }
        Returns: boolean
      }
      jwt_company_id: { Args: never; Returns: string }
      performance_dashboard_rpc: {
        Args: { p_month_year: string; p_today?: string }
        Returns: Json
      }
      preview_salary_for_month: {
        Args: { p_month_year: string }
        Returns: {
          advance_deduction: number
          base_salary: number
          employee_id: string
          external_deduction: number
          net_salary: number
          platform_breakdown: Json
          total_orders: number
          total_shift_days: number
        }[]
      }
      replace_daily_orders_month_rpc: {
        Args: {
          p_file_name?: string
          p_month_year: string
          p_rows?: Json
          p_source_type?: string
          p_target_app_id?: string
        }
        Returns: {
          batch_id: string
          failed_rows: number
          saved_rows: number
        }[]
      }
      rider_profile_performance_rpc: {
        Args: { p_employee_id: string; p_month_year: string; p_today?: string }
        Returns: Json
      }
      test_shift_salary: {
        Args: never
        Returns: {
          app_name: string
          daily_rate: number
          monthly_amount: number
          scheme_name: string
        }[]
      }
    }
    Enums: {
      advance_status: "active" | "completed" | "paused"
      app_role: "admin" | "hr" | "finance" | "operations" | "viewer"
      approval_status: "pending" | "approved" | "rejected"
      attendance_status: "present" | "absent" | "leave" | "sick" | "late"
      city_enum: "makkah" | "jeddah"
      deduction_type: "fine" | "return" | "delay" | "accident" | "other"
      employee_status: "active" | "inactive" | "ended"
      installment_status: "pending" | "deducted" | "deferred"
      license_status_enum: "has_license" | "no_license" | "applied"
      maintenance_type: "routine" | "breakdown" | "accident"
      salary_type: "shift" | "orders"
      scheme_status: "active" | "archived"
      sponsorship_status_enum:
        | "sponsored"
        | "not_sponsored"
        | "absconded"
        | "terminated"
      vehicle_status:
        | "active"
        | "maintenance"
        | "inactive"
        | "breakdown"
        | "rental"
        | "ended"
      vehicle_type: "motorcycle" | "car"
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
      advance_status: ["active", "completed", "paused"],
      app_role: ["admin", "hr", "finance", "operations", "viewer"],
      approval_status: ["pending", "approved", "rejected"],
      attendance_status: ["present", "absent", "leave", "sick", "late"],
      city_enum: ["makkah", "jeddah"],
      deduction_type: ["fine", "return", "delay", "accident", "other"],
      employee_status: ["active", "inactive", "ended"],
      installment_status: ["pending", "deducted", "deferred"],
      license_status_enum: ["has_license", "no_license", "applied"],
      maintenance_type: ["routine", "breakdown", "accident"],
      salary_type: ["shift", "orders"],
      scheme_status: ["active", "archived"],
      sponsorship_status_enum: [
        "sponsored",
        "not_sponsored",
        "absconded",
        "terminated",
      ],
      vehicle_status: [
        "active",
        "maintenance",
        "inactive",
        "breakdown",
        "rental",
        "ended",
      ],
      vehicle_type: ["motorcycle", "car"],
    },
  },
} as const
