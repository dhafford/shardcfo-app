export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// -------------------------------------------------------------------
// Database type — generated from Supabase schema
// -------------------------------------------------------------------

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_number: string
          category: string
          company_id: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          name: string
          subcategory: string | null
        }
        Insert: {
          account_number: string
          category: string
          company_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          name: string
          subcategory?: string | null
        }
        Update: {
          account_number?: string
          category?: string
          company_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          name?: string
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_decks: {
        Row: {
          company_id: string
          created_at: string
          generated_pdf_url: string | null
          generated_pptx_url: string | null
          id: string
          period_end: string
          period_start: string
          presenter_notes: Json | null
          sections: Json
          status: string
          template_key: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          generated_pdf_url?: string | null
          generated_pptx_url?: string | null
          id?: string
          period_end: string
          period_start: string
          presenter_notes?: Json | null
          sections?: Json
          status?: string
          template_key?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          generated_pdf_url?: string | null
          generated_pptx_url?: string | null
          id?: string
          period_end?: string
          period_start?: string
          presenter_notes?: Json | null
          sections?: Json
          status?: string
          template_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_decks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          currency: string
          fiscal_year_end_month: number | null
          id: string
          industry: string | null
          legal_entity: string | null
          logo_url: string | null
          metadata: Json | null
          name: string
          owner_id: string
          stage: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          fiscal_year_end_month?: number | null
          id?: string
          industry?: string | null
          legal_entity?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name: string
          owner_id: string
          stage?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          fiscal_year_end_month?: number | null
          id?: string
          industry?: string | null
          legal_entity?: string | null
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          owner_id?: string
          stage?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_imports: {
        Row: {
          company_id: string
          created_at: string
          error_log: Json | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          mapping_config: Json | null
          row_count: number | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_log?: Json | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          mapping_config?: Json | null
          row_count?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_log?: Json | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          mapping_config?: Json | null
          row_count?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_documents: {
        Row: {
          company_id: string
          created_at: string
          document_name: string
          document_type: string | null
          file_path: string | null
          folder: string
          id: string
          notes: string | null
          status: string
          subfolder: string | null
          updated_at: string
          uploaded_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_name: string
          document_type?: string | null
          file_path?: string | null
          folder: string
          id?: string
          notes?: string | null
          status?: string
          subfolder?: string | null
          updated_at?: string
          uploaded_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_name?: string
          document_type?: string | null
          file_path?: string | null
          folder?: string
          id?: string
          notes?: string | null
          status?: string
          subfolder?: string | null
          updated_at?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_room_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_assessments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          items: Json
          notes: string | null
          overall_score: number
          stage: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          overall_score?: number
          stage: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          overall_score?: number
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_assessments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_findings: {
        Row: {
          assessment_id: string | null
          category: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          impact: string | null
          recommendation: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          category: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          recommendation?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          category?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          recommendation?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_findings_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "dd_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_findings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_items: {
        Row: {
          assignee: string | null
          category: string
          company_id: string
          created_at: string
          data_room_path: string | null
          description: string | null
          document_type: string | null
          due_date: string | null
          id: string
          item_name: string
          notes: string | null
          priority: string
          required_stages: string[] | null
          status: string
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          category: string
          company_id: string
          created_at?: string
          data_room_path?: string | null
          description?: string | null
          document_type?: string | null
          due_date?: string | null
          id?: string
          item_name: string
          notes?: string | null
          priority?: string
          required_stages?: string[] | null
          status?: string
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          category?: string
          company_id?: string
          created_at?: string
          data_room_path?: string | null
          description?: string | null
          document_type?: string | null
          due_date?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          priority?: string
          required_stages?: string[] | null
          status?: string
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          company_id: string
          created_at: string
          id: string
          period_date: string
          period_type: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          period_date: string
          period_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          period_date?: string
          period_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          period_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          period_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "financial_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          company_id: string
          created_at: string
          id: string
          metric_key: string
          metric_unit: string | null
          metric_value: number
          period_date: string
          source: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          metric_key: string
          metric_unit?: string | null
          metric_value: number
          period_date: string
          source?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          metric_key?: string
          metric_unit?: string | null
          metric_value?: number
          period_date?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          firm_name: string | null
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          firm_name?: string | null
          full_name: string
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          firm_name?: string | null
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      qoe_adjustments: {
        Row: {
          adjustment_type: string
          amount: number
          category: string | null
          company_id: string
          created_at: string
          description: string
          id: string
          period_date: string
          updated_at: string
        }
        Insert: {
          adjustment_type: string
          amount: number
          category?: string | null
          company_id: string
          created_at?: string
          description: string
          id?: string
          period_date: string
          updated_at?: string
        }
        Update: {
          adjustment_type?: string
          amount?: number
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          period_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qoe_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_files: {
        Row: {
          id: string
          company_id: string
          file_name: string
          file_size: number
          mime_type: string | null
          category: string
          storage_path: string
          uploaded_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          file_name: string
          file_size: number
          mime_type?: string | null
          category?: string
          storage_path: string
          uploaded_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          file_name?: string
          file_size?: number
          mime_type?: string | null
          category?: string
          storage_path?: string
          uploaded_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          assumptions: Json
          base_period_date: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          results_cache: Json | null
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          base_period_date: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          results_cache?: Json | null
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          base_period_date?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          results_cache?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_runway: {
        Args: { p_company_id: string }
        Returns: {
          avg_monthly_burn: number
          calculation_date: string
          cash_balance: number
          months_sampled: number
          runway_months: number
        }[]
      }
      get_budget_variance: {
        Args: { p_company_id: string; p_period_date: string }
        Returns: {
          account_id: string
          account_name: string
          account_number: string
          actual_amount: number
          budget_amount: number
          category: string
          subcategory: string
          variance: number
          variance_pct: number
        }[]
      }
      get_cash_flow_summary: {
        Args: { p_company_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          account_name: string
          account_number: string
          amount: number
          category: string
          period_date: string
          subcategory: string
        }[]
      }
      get_pnl_summary: {
        Args: {
          p_company_id: string
          p_end_date: string
          p_period_type?: string
          p_start_date: string
        }
        Returns: {
          account_id: string
          account_name: string
          account_number: string
          amount: number
          category: string
          period_date: string
          subcategory: string
        }[]
      }
      get_saas_metrics_dashboard: {
        Args: { p_company_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          metric_key: string
          metric_unit: string
          metric_value: number
          period_date: string
          source: string
        }[]
      }
      seed_demo_data: { Args: { p_owner_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// -------------------------------------------------------------------
// Row type aliases — derived from Database for query result typing
// -------------------------------------------------------------------

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type CompanyRow = Database['public']['Tables']['companies']['Row']
export type FinancialPeriodRow = Database['public']['Tables']['financial_periods']['Row']
export type AccountRow = Database['public']['Tables']['accounts']['Row']
export type LineItemRow = Database['public']['Tables']['line_items']['Row']
export type MetricRow = Database['public']['Tables']['metrics']['Row']
export type BoardDeckRow = Database['public']['Tables']['board_decks']['Row']
export type DataImportRow = Database['public']['Tables']['data_imports']['Row']
export type ScenarioRow = Database['public']['Tables']['scenarios']['Row']
export type AuditLogRow = Database['public']['Tables']['audit_log']['Row']
export type DDAssessmentRow = Database['public']['Tables']['dd_assessments']['Row']
export type DDItemRow = Database['public']['Tables']['dd_items']['Row']
export type DataRoomDocumentRow = Database['public']['Tables']['data_room_documents']['Row']
export type DDFindingRow = Database['public']['Tables']['dd_findings']['Row']
export type QoEAdjustmentRow = Database['public']['Tables']['qoe_adjustments']['Row']
export type CompanyFileRow = Database['public']['Tables']['company_files']['Row']

// -------------------------------------------------------------------
// Insert type aliases
// -------------------------------------------------------------------

export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type CompanyInsert = Database['public']['Tables']['companies']['Insert']
export type FinancialPeriodInsert = Database['public']['Tables']['financial_periods']['Insert']
export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type LineItemInsert = Database['public']['Tables']['line_items']['Insert']
export type MetricInsert = Database['public']['Tables']['metrics']['Insert']
export type BoardDeckInsert = Database['public']['Tables']['board_decks']['Insert']
export type DataImportInsert = Database['public']['Tables']['data_imports']['Insert']
export type ScenarioInsert = Database['public']['Tables']['scenarios']['Insert']
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert']
export type DDAssessmentInsert = Database['public']['Tables']['dd_assessments']['Insert']
export type DDItemInsert = Database['public']['Tables']['dd_items']['Insert']
export type DataRoomDocumentInsert = Database['public']['Tables']['data_room_documents']['Insert']
export type DDFindingInsert = Database['public']['Tables']['dd_findings']['Insert']
export type QoEAdjustmentInsert = Database['public']['Tables']['qoe_adjustments']['Insert']
export type CompanyFileInsert = Database['public']['Tables']['company_files']['Insert']

// -------------------------------------------------------------------
// Update type aliases
// -------------------------------------------------------------------

export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type CompanyUpdate = Database['public']['Tables']['companies']['Update']
export type FinancialPeriodUpdate = Database['public']['Tables']['financial_periods']['Update']
export type AccountUpdate = Database['public']['Tables']['accounts']['Update']
export type LineItemUpdate = Database['public']['Tables']['line_items']['Update']
export type MetricUpdate = Database['public']['Tables']['metrics']['Update']
export type BoardDeckUpdate = Database['public']['Tables']['board_decks']['Update']
export type DataImportUpdate = Database['public']['Tables']['data_imports']['Update']
export type ScenarioUpdate = Database['public']['Tables']['scenarios']['Update']
export type AuditLogUpdate = Database['public']['Tables']['audit_log']['Update']
export type DDAssessmentUpdate = Database['public']['Tables']['dd_assessments']['Update']
export type DDItemUpdate = Database['public']['Tables']['dd_items']['Update']
export type DataRoomDocumentUpdate = Database['public']['Tables']['data_room_documents']['Update']
export type DDFindingUpdate = Database['public']['Tables']['dd_findings']['Update']
export type QoEAdjustmentUpdate = Database['public']['Tables']['qoe_adjustments']['Update']
export type CompanyFileUpdate = Database['public']['Tables']['company_files']['Update']

// -------------------------------------------------------------------
// Convenience type helpers
// -------------------------------------------------------------------

export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// -------------------------------------------------------------------
// Application-layer enum types (for validation, not DB schema)
// -------------------------------------------------------------------

export type UserRole = 'cfo' | 'admin' | 'viewer'
export type CompanyStatus = 'active' | 'archived' | 'onboarding'
export type PeriodType = 'monthly' | 'quarterly' | 'annual'
export type AccountType = 'revenue' | 'cogs' | 'opex' | 'asset' | 'liability' | 'equity' | 'other'
export type AccountCategory =
  | 'arr'
  | 'mrr'
  | 'services'
  | 'gross_profit'
  | 'sales_marketing'
  | 'research_development'
  | 'general_administrative'
  | 'ebitda'
  | 'cash'
  | 'accounts_receivable'
  | 'other'
export type LineItemType = 'actual' | 'budget' | 'forecast'
export type MetricCategory =
  | 'growth'
  | 'profitability'
  | 'efficiency'
  | 'retention'
  | 'sales'
  | 'other'
export type DeckStatus = 'draft' | 'review' | 'final' | 'presented'
export type ImportStatus = 'pending' | 'processing' | 'mapped' | 'imported' | 'failed'
export type ImportSource = 'csv' | 'excel' | 'quickbooks' | 'xero' | 'manual'
export type ScenarioType = 'base' | 'upside' | 'downside' | 'custom'
export type AuditAction = 'insert' | 'update' | 'delete' | 'login' | 'logout' | 'export'

export type DDStage = 'seed' | 'series_a' | 'series_b' | 'series_c' | 'growth'
export type DDCategory =
  | 'corporate'
  | 'financial'
  | 'tax'
  | 'legal'
  | 'hr'
  | 'product_tech'
  | 'fundraising'
export type DDItemStatus = 'not_started' | 'in_progress' | 'complete' | 'not_applicable'
export type DDPriority = 'critical' | 'high' | 'medium' | 'low'
export type DDSeverity = 'critical' | 'significant' | 'moderate' | 'observation'
export type DDDocumentType = 'pdf' | 'excel' | 'csv' | 'contract' | 'other'
export type DataRoomDocStatus = 'pending' | 'uploaded' | 'verified' | 'needs_update'
export type QoEAdjustmentType =
  | 'non_recurring'
  | 'non_operating'
  | 'out_of_period'
  | 'owner_discretionary'
  | 'related_party'
  | 'run_rate'
export type FileCategory = 'historicals' | 'projections' | 'board_materials' | 'investment_memorandum' | 'other'
