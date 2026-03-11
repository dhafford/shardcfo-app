-- =============================================================================
-- ShardCFO Initial Schema Migration
-- =============================================================================
-- PostgreSQL 17 / Supabase
-- All tables live in the public schema and are secured via Row Level Security.
-- Ownership is established through auth.uid() -> profiles.id -> companies.owner_id
-- and propagated through foreign-key joins for child tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- trigram indexes for text search


-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  avatar_url  TEXT,
  role        TEXT        NOT NULL DEFAULT 'cfo'
                          CHECK (role IN ('cfo', 'admin', 'viewer')),
  firm_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

CREATE TABLE public.companies (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  legal_entity          TEXT,
  industry              TEXT,
  stage                 TEXT        CHECK (stage IN (
                          'pre_seed', 'seed', 'series_a', 'series_b',
                          'series_c', 'growth', 'public'
                        )),
  fiscal_year_end_month INTEGER     DEFAULT 12
                          CHECK (fiscal_year_end_month BETWEEN 1 AND 12),
  currency              TEXT        NOT NULL DEFAULT 'USD',
  logo_url              TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'archived', 'onboarding')),
  metadata              JSONB       DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- financial_periods
-- ---------------------------------------------------------------------------

CREATE TABLE public.financial_periods (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_date DATE        NOT NULL,
  period_type TEXT        NOT NULL DEFAULT 'actual'
                          CHECK (period_type IN ('actual', 'budget', 'forecast', 'reforecast')),
  status      TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'review', 'approved', 'locked')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_date, period_type)
);

CREATE TRIGGER trg_financial_periods_updated_at
  BEFORE UPDATE ON public.financial_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

CREATE TABLE public.accounts (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID    NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_number TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  category       TEXT    NOT NULL CHECK (category IN (
                   'revenue', 'cogs', 'operating_expense', 'other_income',
                   'other_expense', 'asset', 'liability', 'equity'
                 )),
  subcategory    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  display_order  INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, account_number)
);

-- accounts has no updated_at column per spec


-- ---------------------------------------------------------------------------
-- line_items
-- ---------------------------------------------------------------------------

CREATE TABLE public.line_items (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID           NOT NULL REFERENCES public.financial_periods(id) ON DELETE CASCADE,
  account_id  UUID           NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (period_id, account_id)
);

CREATE TRIGGER trg_line_items_updated_at
  BEFORE UPDATE ON public.line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- metrics
-- ---------------------------------------------------------------------------

CREATE TABLE public.metrics (
  id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID           NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_date  DATE           NOT NULL,
  metric_key   TEXT           NOT NULL,
  metric_value NUMERIC(15, 4) NOT NULL,
  metric_unit  TEXT,
  source       TEXT,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_date, metric_key)
);

-- metrics has no updated_at column per spec


-- ---------------------------------------------------------------------------
-- board_decks
-- ---------------------------------------------------------------------------

CREATE TABLE public.board_decks (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'review', 'final', 'presented')),
  template_key        TEXT        NOT NULL DEFAULT 'standard',
  sections            JSONB       NOT NULL DEFAULT '[]',
  generated_pdf_url   TEXT,
  generated_pptx_url  TEXT,
  presenter_notes     JSONB       DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_board_decks_updated_at
  BEFORE UPDATE ON public.board_decks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- data_imports
-- ---------------------------------------------------------------------------

CREATE TABLE public.data_imports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name      TEXT        NOT NULL,
  file_url       TEXT        NOT NULL,
  file_type      TEXT        NOT NULL
                 CHECK (file_type IN ('csv', 'xlsx', 'qbo', 'xero_export')),
  status         TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'mapped', 'imported', 'failed')),
  row_count      INTEGER,
  mapping_config JSONB       DEFAULT '{}',
  error_log      JSONB       DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_data_imports_updated_at
  BEFORE UPDATE ON public.data_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- scenarios
-- ---------------------------------------------------------------------------

CREATE TABLE public.scenarios (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT,
  base_period_date DATE        NOT NULL,
  assumptions      JSONB       NOT NULL DEFAULT '{}',
  results_cache    JSONB       DEFAULT '{}',
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_scenarios_updated_at
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES public.profiles(id),
  company_id  UUID        REFERENCES public.companies(id),
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   UUID,
  details     JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- audit_log is append-only; no updated_at


-- =============================================================================
-- INDEXES
-- =============================================================================

-- profiles
CREATE INDEX idx_profiles_email        ON public.profiles (email);
CREATE INDEX idx_profiles_role         ON public.profiles (role);

-- companies
CREATE INDEX idx_companies_owner_id    ON public.companies (owner_id);
CREATE INDEX idx_companies_status      ON public.companies (status);

-- financial_periods
CREATE INDEX idx_fp_company_id         ON public.financial_periods (company_id);
CREATE INDEX idx_fp_period_date        ON public.financial_periods (period_date);
CREATE INDEX idx_fp_period_type        ON public.financial_periods (period_type);
CREATE INDEX idx_fp_company_date_type  ON public.financial_periods (company_id, period_date, period_type);

-- accounts
CREATE INDEX idx_accounts_company_id   ON public.accounts (company_id);
CREATE INDEX idx_accounts_category     ON public.accounts (category);
CREATE INDEX idx_accounts_is_active    ON public.accounts (company_id, is_active);

-- line_items
CREATE INDEX idx_li_period_id          ON public.line_items (period_id);
CREATE INDEX idx_li_account_id         ON public.line_items (account_id);

-- metrics
CREATE INDEX idx_metrics_company_id    ON public.metrics (company_id);
CREATE INDEX idx_metrics_period_date   ON public.metrics (period_date);
CREATE INDEX idx_metrics_metric_key    ON public.metrics (metric_key);
CREATE INDEX idx_metrics_company_date  ON public.metrics (company_id, period_date);

-- board_decks
CREATE INDEX idx_bd_company_id         ON public.board_decks (company_id);
CREATE INDEX idx_bd_status             ON public.board_decks (status);

-- data_imports
CREATE INDEX idx_di_company_id         ON public.data_imports (company_id);
CREATE INDEX idx_di_status             ON public.data_imports (status);

-- scenarios
CREATE INDEX idx_sc_company_id         ON public.scenarios (company_id);
CREATE INDEX idx_sc_is_active          ON public.scenarios (company_id, is_active);

-- audit_log
CREATE INDEX idx_al_user_id            ON public.audit_log (user_id);
CREATE INDEX idx_al_company_id         ON public.audit_log (company_id);
CREATE INDEX idx_al_entity             ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_al_created_at         ON public.audit_log (created_at DESC);


-- =============================================================================
-- AUTO-CREATE PROFILE ON AUTH USER INSERT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_decks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_imports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles policies
-- ---------------------------------------------------------------------------

-- Users can only read and modify their own profile row.
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Deletion is handled via auth.users cascade; no direct delete policy needed.

-- ---------------------------------------------------------------------------
-- companies policies
-- ---------------------------------------------------------------------------

-- A company is visible / editable only by its owner.
CREATE POLICY "companies_select_owner"
  ON public.companies FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "companies_insert_owner"
  ON public.companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "companies_update_owner"
  ON public.companies FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "companies_delete_owner"
  ON public.companies FOR DELETE
  USING (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- financial_periods policies  (join through companies)
-- ---------------------------------------------------------------------------

CREATE POLICY "fp_select_owner"
  ON public.financial_periods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "fp_insert_owner"
  ON public.financial_periods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "fp_update_owner"
  ON public.financial_periods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "fp_delete_owner"
  ON public.financial_periods FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- accounts policies  (join through companies)
-- ---------------------------------------------------------------------------

CREATE POLICY "accounts_select_owner"
  ON public.accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "accounts_insert_owner"
  ON public.accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "accounts_update_owner"
  ON public.accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "accounts_delete_owner"
  ON public.accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- line_items policies  (join through financial_periods -> companies)
-- ---------------------------------------------------------------------------

CREATE POLICY "li_select_owner"
  ON public.line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.financial_periods fp
      JOIN public.companies c ON c.id = fp.company_id
      WHERE fp.id = period_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "li_insert_owner"
  ON public.line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.financial_periods fp
      JOIN public.companies c ON c.id = fp.company_id
      WHERE fp.id = period_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "li_update_owner"
  ON public.line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.financial_periods fp
      JOIN public.companies c ON c.id = fp.company_id
      WHERE fp.id = period_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "li_delete_owner"
  ON public.line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.financial_periods fp
      JOIN public.companies c ON c.id = fp.company_id
      WHERE fp.id = period_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- metrics policies  (join through companies)
-- ---------------------------------------------------------------------------

CREATE POLICY "metrics_select_owner"
  ON public.metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "metrics_insert_owner"
  ON public.metrics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "metrics_update_owner"
  ON public.metrics FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "metrics_delete_owner"
  ON public.metrics FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- board_decks policies  (join through companies)
-- ---------------------------------------------------------------------------

CREATE POLICY "bd_select_owner"
  ON public.board_decks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "bd_insert_owner"
  ON public.board_decks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "bd_update_owner"
  ON public.board_decks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "bd_delete_owner"
  ON public.board_decks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- data_imports policies  (join through companies)
-- ---------------------------------------------------------------------------

CREATE POLICY "di_select_owner"
  ON public.data_imports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "di_insert_owner"
  ON public.data_imports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "di_update_owner"
  ON public.data_imports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "di_delete_owner"
  ON public.data_imports FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- scenarios policies  (join through companies)
-- ---------------------------------------------------------------------------

CREATE POLICY "sc_select_owner"
  ON public.scenarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "sc_insert_owner"
  ON public.scenarios FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "sc_update_owner"
  ON public.scenarios FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "sc_delete_owner"
  ON public.scenarios FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- audit_log policies
-- ---------------------------------------------------------------------------

-- Users may read their own audit entries or entries for companies they own.
-- No INSERT policy via client; writes happen only inside SECURITY DEFINER functions.
CREATE POLICY "al_select_owner"
  ON public.audit_log FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- Clients cannot directly insert, update, or delete audit rows.
-- (service_role key bypasses RLS for server-side writes.)


-- =============================================================================
-- DATABASE FUNCTIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_pnl_summary
-- Returns period-by-period P&L grouped by account category for a date range.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_pnl_summary(
  p_company_id  UUID,
  p_start_date  DATE,
  p_end_date    DATE,
  p_period_type TEXT DEFAULT 'actual'
)
RETURNS TABLE (
  period_date   DATE,
  category      TEXT,
  subcategory   TEXT,
  account_id    UUID,
  account_name  TEXT,
  account_number TEXT,
  amount        NUMERIC(15, 2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fp.period_date,
    a.category,
    a.subcategory,
    a.id          AS account_id,
    a.name        AS account_name,
    a.account_number,
    li.amount
  FROM public.line_items li
  JOIN public.financial_periods fp ON fp.id = li.period_id
  JOIN public.accounts a           ON a.id  = li.account_id
  JOIN public.companies c          ON c.id  = fp.company_id
  WHERE fp.company_id   = p_company_id
    AND c.owner_id      = auth.uid()
    AND fp.period_date  BETWEEN p_start_date AND p_end_date
    AND fp.period_type  = p_period_type
    AND a.category      IN (
          'revenue', 'cogs', 'operating_expense',
          'other_income', 'other_expense'
        )
    AND a.is_active     = true
  ORDER BY fp.period_date, a.category, a.display_order, a.account_number;
$$;


-- ---------------------------------------------------------------------------
-- get_cash_flow_summary
-- Returns aggregated cash-flow line items (asset/liability/equity movements).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_cash_flow_summary(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  period_date   DATE,
  category      TEXT,
  subcategory   TEXT,
  account_name  TEXT,
  account_number TEXT,
  amount        NUMERIC(15, 2)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fp.period_date,
    a.category,
    a.subcategory,
    a.name        AS account_name,
    a.account_number,
    li.amount
  FROM public.line_items li
  JOIN public.financial_periods fp ON fp.id = li.period_id
  JOIN public.accounts a           ON a.id  = li.account_id
  JOIN public.companies c          ON c.id  = fp.company_id
  WHERE fp.company_id   = p_company_id
    AND c.owner_id      = auth.uid()
    AND fp.period_date  BETWEEN p_start_date AND p_end_date
    AND fp.period_type  = 'actual'
    AND a.category      IN ('asset', 'liability', 'equity')
    AND a.is_active     = true
  ORDER BY fp.period_date, a.category, a.display_order, a.account_number;
$$;


-- ---------------------------------------------------------------------------
-- get_saas_metrics_dashboard
-- Returns SaaS-relevant metrics (MRR, ARR, churn, CAC, LTV, NDR, etc.)
-- for a given date range, pivoted as metric_key / metric_value rows.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_saas_metrics_dashboard(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  period_date  DATE,
  metric_key   TEXT,
  metric_value NUMERIC(15, 4),
  metric_unit  TEXT,
  source       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.period_date,
    m.metric_key,
    m.metric_value,
    m.metric_unit,
    m.source
  FROM public.metrics m
  JOIN public.companies c ON c.id = m.company_id
  WHERE m.company_id   = p_company_id
    AND c.owner_id     = auth.uid()
    AND m.period_date  BETWEEN p_start_date AND p_end_date
    AND m.metric_key   IN (
          'mrr', 'arr', 'new_mrr', 'expansion_mrr', 'churned_mrr',
          'net_new_mrr', 'customer_count', 'churned_customers',
          'churn_rate', 'ndr', 'cac', 'ltv', 'ltv_cac_ratio',
          'average_contract_value', 'arpu', 'magic_number',
          'rule_of_40', 'burn_multiple'
        )
  ORDER BY m.period_date, m.metric_key;
$$;


-- ---------------------------------------------------------------------------
-- get_budget_variance
-- Returns actual vs. budget side-by-side for a given period_date,
-- including variance amount and variance percentage.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_budget_variance(
  p_company_id  UUID,
  p_period_date DATE
)
RETURNS TABLE (
  account_id      UUID,
  account_name    TEXT,
  account_number  TEXT,
  category        TEXT,
  subcategory     TEXT,
  actual_amount   NUMERIC(15, 2),
  budget_amount   NUMERIC(15, 2),
  variance        NUMERIC(15, 2),
  variance_pct    NUMERIC(7, 4)
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH actual_data AS (
    SELECT
      li.account_id,
      li.amount AS actual_amount
    FROM public.line_items li
    JOIN public.financial_periods fp ON fp.id = li.period_id
    JOIN public.companies c          ON c.id  = fp.company_id
    WHERE fp.company_id   = p_company_id
      AND c.owner_id      = auth.uid()
      AND fp.period_date  = p_period_date
      AND fp.period_type  = 'actual'
  ),
  budget_data AS (
    SELECT
      li.account_id,
      li.amount AS budget_amount
    FROM public.line_items li
    JOIN public.financial_periods fp ON fp.id = li.period_id
    JOIN public.companies c          ON c.id  = fp.company_id
    WHERE fp.company_id   = p_company_id
      AND c.owner_id      = auth.uid()
      AND fp.period_date  = p_period_date
      AND fp.period_type  = 'budget'
  )
  SELECT
    a.id                                                    AS account_id,
    a.name                                                  AS account_name,
    a.account_number,
    a.category,
    a.subcategory,
    COALESCE(act.actual_amount, 0)                          AS actual_amount,
    COALESCE(bud.budget_amount, 0)                          AS budget_amount,
    COALESCE(act.actual_amount, 0) - COALESCE(bud.budget_amount, 0) AS variance,
    CASE
      WHEN COALESCE(bud.budget_amount, 0) = 0 THEN NULL
      ELSE ROUND(
        (COALESCE(act.actual_amount, 0) - COALESCE(bud.budget_amount, 0))
        / ABS(bud.budget_amount) * 100,
        4
      )
    END                                                     AS variance_pct
  FROM public.accounts a
  LEFT JOIN actual_data act ON act.account_id = a.id
  LEFT JOIN budget_data bud ON bud.account_id = a.id
  JOIN public.companies c   ON c.id            = a.company_id
  WHERE a.company_id  = p_company_id
    AND c.owner_id    = auth.uid()
    AND a.is_active   = true
    AND (act.account_id IS NOT NULL OR bud.account_id IS NOT NULL)
  ORDER BY a.category, a.display_order, a.account_number;
$$;


-- ---------------------------------------------------------------------------
-- calculate_runway
-- Returns estimated months of runway based on the most recent 3-month
-- average net cash burn (operating_expense + cogs - revenue) and the
-- most recent cash/cash-equivalent asset balance.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_runway(
  p_company_id UUID
)
RETURNS TABLE (
  cash_balance        NUMERIC(15, 2),
  avg_monthly_burn    NUMERIC(15, 2),
  runway_months       NUMERIC(7, 2),
  calculation_date    DATE,
  months_sampled      INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_balance     NUMERIC(15, 2) := 0;
  v_avg_burn         NUMERIC(15, 2) := 0;
  v_months_sampled   INTEGER        := 0;
  v_latest_date      DATE;
  v_runway           NUMERIC(7, 2)  := NULL;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id AND c.owner_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  -- Most recent actual period date
  SELECT MAX(fp.period_date)
    INTO v_latest_date
    FROM public.financial_periods fp
   WHERE fp.company_id  = p_company_id
     AND fp.period_type = 'actual'
     AND fp.status      IN ('approved', 'locked');

  IF v_latest_date IS NULL THEN
    RETURN;
  END IF;

  -- Cash balance: sum of asset accounts tagged 'cash' in subcategory on latest date.
  -- Falls back to total asset balance if no cash subcategory exists.
  SELECT COALESCE(SUM(li.amount), 0)
    INTO v_cash_balance
    FROM public.line_items li
    JOIN public.financial_periods fp ON fp.id = li.period_id
    JOIN public.accounts a           ON a.id  = li.account_id
   WHERE fp.company_id   = p_company_id
     AND fp.period_date  = v_latest_date
     AND fp.period_type  = 'actual'
     AND a.category      = 'asset'
     AND (a.subcategory ILIKE '%cash%' OR a.subcategory IS NULL);

  -- Average monthly net burn over the most recent 3 approved/locked months.
  -- Burn = (COGS + operating_expense) - revenue  (positive = burning cash)
  SELECT
    COALESCE(AVG(period_burn), 0),
    COUNT(*)
  INTO v_avg_burn, v_months_sampled
  FROM (
    SELECT
      fp.period_date,
      SUM(
        CASE
          WHEN a.category IN ('cogs', 'operating_expense') THEN  li.amount
          WHEN a.category = 'revenue'                      THEN -li.amount
          ELSE 0
        END
      ) AS period_burn
    FROM public.line_items li
    JOIN public.financial_periods fp ON fp.id = li.period_id
    JOIN public.accounts a           ON a.id  = li.account_id
   WHERE fp.company_id   = p_company_id
     AND fp.period_type  = 'actual'
     AND fp.status       IN ('approved', 'locked')
     AND fp.period_date  BETWEEN (v_latest_date - INTERVAL '2 months')::DATE
                              AND v_latest_date
     AND a.category      IN ('revenue', 'cogs', 'operating_expense')
   GROUP BY fp.period_date
   ORDER BY fp.period_date DESC
   LIMIT 3
  ) burn_by_period;

  -- Runway = cash / burn  (NULL if burn <= 0 meaning company is cash-flow positive)
  IF v_avg_burn > 0 THEN
    v_runway := ROUND(v_cash_balance / v_avg_burn, 2);
  END IF;

  RETURN QUERY
  SELECT
    v_cash_balance,
    v_avg_burn,
    v_runway,
    v_latest_date,
    v_months_sampled;
END;
$$;


-- =============================================================================
-- GRANT USAGE TO authenticated ROLE
-- (postgREST / Supabase auto-API picks these up)
-- =============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_items        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metrics           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_decks       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_imports      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios         TO authenticated;
GRANT SELECT                         ON public.audit_log         TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_pnl_summary(UUID, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_summary(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_saas_metrics_dashboard(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_budget_variance(UUID, DATE)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_runway(UUID)                  TO authenticated;

-- anon role should not access any application tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
