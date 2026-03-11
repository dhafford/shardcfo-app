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

export type UserRole = 'admin' | 'analyst' | 'viewer'
export type CompanyStatus = 'active' | 'inactive' | 'archived'
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
  user_id: string
  company_id: string | null
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface CompanyRow {
  id: string
  name: string
  slug: string
  logo_url: string | null
  industry: string | null
  founded_year: number | null
  fiscal_year_end_month: number
  currency: string
  status: CompanyStatus
  settings: Json
  created_at: string
  updated_at: string
}

export interface FinancialPeriodRow {
  id: string
  company_id: string
  period_type: PeriodType
  period_label: string
  start_date: string
  end_date: string
  is_locked: boolean
  locked_by: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

export interface AccountRow {
  id: string
  company_id: string
  code: string | null
  name: string
  account_type: AccountType
  category: AccountCategory | null
  parent_account_id: string | null
  display_order: number
  is_active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export interface LineItemRow {
  id: string
  company_id: string
  financial_period_id: string
  account_id: string
  scenario_id: string | null
  line_item_type: LineItemType
  amount: number
  notes: string | null
  source: string | null
  imported_by: string | null
  created_at: string
  updated_at: string
}

export interface MetricRow {
  id: string
  company_id: string
  financial_period_id: string
  scenario_id: string | null
  name: string
  slug: string
  value: number
  unit: string | null
  category: MetricCategory
  is_computed: boolean
  formula: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export interface BoardDeckRow {
  id: string
  company_id: string
  title: string
  description: string | null
  period_ids: string[]
  status: DeckStatus
  template_id: string | null
  content: Json
  published_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface DataImportRow {
  id: string
  company_id: string
  imported_by: string
  source: ImportSource
  file_name: string | null
  file_url: string | null
  status: ImportStatus
  rows_total: number | null
  rows_imported: number | null
  rows_failed: number | null
  error_log: Json
  mapping_config: Json
  financial_period_id: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ScenarioRow {
  id: string
  company_id: string
  name: string
  description: string | null
  scenario_type: ScenarioType
  base_scenario_id: string | null
  is_active: boolean
  assumptions: Json
  created_by: string
  created_at: string
  updated_at: string
}

export interface AuditLogRow {
  id: string
  company_id: string | null
  user_id: string | null
  action: AuditAction
  table_name: string | null
  record_id: string | null
  old_values: Json
  new_values: Json
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// -------------------------------------------------------------------
// Insert types — fields required / optional when inserting a new row
// -------------------------------------------------------------------

export interface ProfileInsert {
  id?: string
  user_id: string
  company_id?: string | null
  full_name?: string | null
  avatar_url?: string | null
  role?: UserRole
  is_active?: boolean
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface CompanyInsert {
  id?: string
  name: string
  slug: string
  logo_url?: string | null
  industry?: string | null
  founded_year?: number | null
  fiscal_year_end_month?: number
  currency?: string
  status?: CompanyStatus
  settings?: Json
  created_at?: string
  updated_at?: string
}

export interface FinancialPeriodInsert {
  id?: string
  company_id: string
  period_type: PeriodType
  period_label: string
  start_date: string
  end_date: string
  is_locked?: boolean
  locked_by?: string | null
  locked_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface AccountInsert {
  id?: string
  company_id: string
  code?: string | null
  name: string
  account_type: AccountType
  category?: AccountCategory | null
  parent_account_id?: string | null
  display_order?: number
  is_active?: boolean
  description?: string | null
  created_at?: string
  updated_at?: string
}

export interface LineItemInsert {
  id?: string
  company_id: string
  financial_period_id: string
  account_id: string
  scenario_id?: string | null
  line_item_type?: LineItemType
  amount: number
  notes?: string | null
  source?: string | null
  imported_by?: string | null
  created_at?: string
  updated_at?: string
}

export interface MetricInsert {
  id?: string
  company_id: string
  financial_period_id: string
  scenario_id?: string | null
  name: string
  slug: string
  value: number
  unit?: string | null
  category?: MetricCategory
  is_computed?: boolean
  formula?: string | null
  metadata?: Json
  created_at?: string
  updated_at?: string
}

export interface BoardDeckInsert {
  id?: string
  company_id: string
  title: string
  description?: string | null
  period_ids?: string[]
  status?: DeckStatus
  template_id?: string | null
  content?: Json
  published_url?: string | null
  created_by: string
  created_at?: string
  updated_at?: string
}

export interface DataImportInsert {
  id?: string
  company_id: string
  imported_by: string
  source: ImportSource
  file_name?: string | null
  file_url?: string | null
  status?: ImportStatus
  rows_total?: number | null
  rows_imported?: number | null
  rows_failed?: number | null
  error_log?: Json
  mapping_config?: Json
  financial_period_id?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at?: string
}

export interface ScenarioInsert {
  id?: string
  company_id: string
  name: string
  description?: string | null
  scenario_type?: ScenarioType
  base_scenario_id?: string | null
  is_active?: boolean
  assumptions?: Json
  created_by: string
  created_at?: string
  updated_at?: string
}

export interface AuditLogInsert {
  id?: string
  company_id?: string | null
  user_id?: string | null
  action: AuditAction
  table_name?: string | null
  record_id?: string | null
  old_values?: Json
  new_values?: Json
  ip_address?: string | null
  user_agent?: string | null
  created_at?: string
}

// -------------------------------------------------------------------
// Update types — all fields optional for PATCH-style updates
// -------------------------------------------------------------------

export type ProfileUpdate = Partial<Omit<ProfileInsert, 'user_id'>>
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
        Relationships: [
          {
            foreignKeyName: 'profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'profiles_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      companies: {
        Row: CompanyRow
        Insert: CompanyInsert
        Update: CompanyUpdate
        Relationships: []
      }
      financial_periods: {
        Row: FinancialPeriodRow
        Insert: FinancialPeriodInsert
        Update: FinancialPeriodUpdate
        Relationships: [
          {
            foreignKeyName: 'financial_periods_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'financial_periods_locked_by_fkey'
            columns: ['locked_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['user_id']
          },
        ]
      }
      accounts: {
        Row: AccountRow
        Insert: AccountInsert
        Update: AccountUpdate
        Relationships: [
          {
            foreignKeyName: 'accounts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'accounts_parent_account_id_fkey'
            columns: ['parent_account_id']
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
        Relationships: [
          {
            foreignKeyName: 'line_items_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'line_items_financial_period_id_fkey'
            columns: ['financial_period_id']
            isOneToOne: false
            referencedRelation: 'financial_periods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'line_items_account_id_fkey'
            columns: ['account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'line_items_scenario_id_fkey'
            columns: ['scenario_id']
            isOneToOne: false
            referencedRelation: 'scenarios'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'line_items_imported_by_fkey'
            columns: ['imported_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['user_id']
          },
        ]
      }
      metrics: {
        Row: MetricRow
        Insert: MetricInsert
        Update: MetricUpdate
        Relationships: [
          {
            foreignKeyName: 'metrics_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'metrics_financial_period_id_fkey'
            columns: ['financial_period_id']
            isOneToOne: false
            referencedRelation: 'financial_periods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'metrics_scenario_id_fkey'
            columns: ['scenario_id']
            isOneToOne: false
            referencedRelation: 'scenarios'
            referencedColumns: ['id']
          },
        ]
      }
      board_decks: {
        Row: BoardDeckRow
        Insert: BoardDeckInsert
        Update: BoardDeckUpdate
        Relationships: [
          {
            foreignKeyName: 'board_decks_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'board_decks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['user_id']
          },
        ]
      }
      data_imports: {
        Row: DataImportRow
        Insert: DataImportInsert
        Update: DataImportUpdate
        Relationships: [
          {
            foreignKeyName: 'data_imports_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'data_imports_imported_by_fkey'
            columns: ['imported_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['user_id']
          },
          {
            foreignKeyName: 'data_imports_financial_period_id_fkey'
            columns: ['financial_period_id']
            isOneToOne: false
            referencedRelation: 'financial_periods'
            referencedColumns: ['id']
          },
        ]
      }
      scenarios: {
        Row: ScenarioRow
        Insert: ScenarioInsert
        Update: ScenarioUpdate
        Relationships: [
          {
            foreignKeyName: 'scenarios_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'scenarios_base_scenario_id_fkey'
            columns: ['base_scenario_id']
            isOneToOne: false
            referencedRelation: 'scenarios'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'scenarios_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['user_id']
          },
        ]
      }
      audit_log: {
        Row: AuditLogRow
        Insert: AuditLogInsert
        Update: never
        Relationships: [
          {
            foreignKeyName: 'audit_log_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['user_id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      company_status: CompanyStatus
      period_type: PeriodType
      account_type: AccountType
      account_category: AccountCategory
      line_item_type: LineItemType
      metric_category: MetricCategory
      deck_status: DeckStatus
      import_status: ImportStatus
      import_source: ImportSource
      scenario_type: ScenarioType
      audit_action: AuditAction
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
