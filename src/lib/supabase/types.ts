export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// -------------------------------------------------------------------
// Enum types matching CHECK constraints / Postgres enums in the schema
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
export type DeckStatus = 'draft' | 'published' | 'archived'
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ImportSource = 'csv' | 'excel' | 'quickbooks' | 'xero' | 'manual'
export type ScenarioType = 'base' | 'upside' | 'downside' | 'custom'
export type AuditAction = 'insert' | 'update' | 'delete' | 'login' | 'logout' | 'export'

// -------------------------------------------------------------------
// Row types — what SELECT queries return
// -------------------------------------------------------------------

export interface ProfileRow {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: UserRole
  firm_name: string | null
  created_at: string
  updated_at: string
}

export interface CompanyRow {
  id: string
  owner_id: string
  name: string
  legal_entity: string | null
  industry: string | null
  stage: string | null
  fiscal_year_end_month: number
  currency: string
  logo_url: string | null
  status: CompanyStatus
  metadata: Json | null
  created_at: string
  updated_at: string
}

export interface FinancialPeriodRow {
  id: string
  company_id: string
  period_date: string
  period_type: string
  status: string
  created_at: string
  updated_at: string
}

export interface AccountRow {
  id: string
  company_id: string
  account_number: string
  name: string
  category: string
  subcategory: string | null
  is_active: boolean
  display_order: number
  created_at: string
}

export interface LineItemRow {
  id: string
  period_id: string
  account_id: string
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MetricRow {
  id: string
  company_id: string
  period_date: string
  metric_key: string
  metric_value: number
  metric_unit: string | null
  source: string | null
  created_at: string
}

export interface BoardDeckRow {
  id: string
  company_id: string
  title: string
  period_start: string
  period_end: string
  status: string
  template_key: string
  sections: Json
  generated_pdf_url: string | null
  generated_pptx_url: string | null
  presenter_notes: Json
  created_at: string
  updated_at: string
}

export interface DataImportRow {
  id: string
  company_id: string
  file_name: string
  file_url: string
  file_type: string
  status: string
  row_count: number | null
  mapping_config: Json
  error_log: Json
  created_at: string
  updated_at: string
}

export interface ScenarioRow {
  id: string
  company_id: string
  name: string
  description: string | null
  base_period_date: string
  assumptions: Json
  results_cache: Json
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuditLogRow {
  id: string
  user_id: string | null
  company_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Json
  created_at: string
}

// -------------------------------------------------------------------
// Insert types — fields required / optional when inserting a new row
// -------------------------------------------------------------------

export interface ProfileInsert {
  id: string
  full_name: string
  email: string
  avatar_url?: string | null
  role?: UserRole
  firm_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface CompanyInsert {
  id?: string
  name: string
  owner_id: string
  legal_entity?: string | null
  industry?: string | null
  stage?: string | null
  fiscal_year_end_month?: number
  currency?: string
  logo_url?: string | null
  status?: CompanyStatus
  metadata?: Json | null
  created_at?: string
  updated_at?: string
}

export interface FinancialPeriodInsert {
  id?: string
  company_id: string
  period_date: string
  period_type?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export interface AccountInsert {
  id?: string
  company_id: string
  account_number: string
  name: string
  category: string
  subcategory?: string | null
  is_active?: boolean
  display_order?: number
  created_at?: string
}

export interface LineItemInsert {
  id?: string
  period_id: string
  account_id: string
  amount: number
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface MetricInsert {
  id?: string
  company_id: string
  period_date: string
  metric_key: string
  metric_value: number
  metric_unit?: string | null
  source?: string | null
  created_at?: string
}

export interface BoardDeckInsert {
  id?: string
  company_id: string
  title: string
  period_start: string
  period_end: string
  status?: string
  template_key?: string
  sections?: Json
  generated_pdf_url?: string | null
  generated_pptx_url?: string | null
  presenter_notes?: Json
  created_at?: string
  updated_at?: string
}

export interface DataImportInsert {
  id?: string
  company_id: string
  file_name: string
  file_url: string
  file_type: string
  status?: string
  row_count?: number | null
  mapping_config?: Json
  error_log?: Json
  created_at?: string
  updated_at?: string
}

export interface ScenarioInsert {
  id?: string
  company_id: string
  name: string
  description?: string | null
  base_period_date: string
  assumptions?: Json
  results_cache?: Json
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface AuditLogInsert {
  id?: string
  user_id?: string | null
  company_id?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  details?: Json
  created_at?: string
}

// -------------------------------------------------------------------
// Update types — all fields optional for PATCH-style updates
// -------------------------------------------------------------------

export type ProfileUpdate = Partial<Omit<ProfileInsert, 'id'>>
export type CompanyUpdate = Partial<CompanyInsert>
export type FinancialPeriodUpdate = Partial<FinancialPeriodInsert>
export type AccountUpdate = Partial<AccountInsert>
export type LineItemUpdate = Partial<LineItemInsert>
export type MetricUpdate = Partial<MetricInsert>
export type BoardDeckUpdate = Partial<BoardDeckInsert>
export type DataImportUpdate = Partial<DataImportInsert>
export type ScenarioUpdate = Partial<ScenarioInsert>
// audit_log is append-only; no update type needed

// -------------------------------------------------------------------
// Database type — Supabase generated-types shape
// -------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      companies: {
        Row: CompanyRow
        Insert: CompanyInsert
        Update: CompanyUpdate
        Relationships: [
          {
            foreignKeyName: 'companies_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
        ]
      }
      line_items: {
        Row: LineItemRow
        Insert: LineItemInsert
        Update: LineItemUpdate
        Relationships: []
      }
      metrics: {
        Row: MetricRow
        Insert: MetricInsert
        Update: MetricUpdate
        Relationships: []
      }
      board_decks: {
        Row: BoardDeckRow
        Insert: BoardDeckInsert
        Update: BoardDeckUpdate
        Relationships: []
      }
      data_imports: {
        Row: DataImportRow
        Insert: DataImportInsert
        Update: DataImportUpdate
        Relationships: []
      }
      scenarios: {
        Row: ScenarioRow
        Insert: ScenarioInsert
        Update: ScenarioUpdate
        Relationships: []
      }
      audit_log: {
        Row: AuditLogRow
        Insert: AuditLogInsert
        Update: never
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
// Convenience type aliases
// -------------------------------------------------------------------

type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]

export type TableRow<T extends keyof Database['public']['Tables']> =
  Tables<T>['Row']

export type TableInsert<T extends keyof Database['public']['Tables']> =
  Tables<T>['Insert']

export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Tables<T>['Update']
