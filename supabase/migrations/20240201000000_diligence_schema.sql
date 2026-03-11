-- =============================================================================
-- ShardCFO Due Diligence Schema Migration
-- =============================================================================
-- Adds tables for due diligence workflows: readiness assessments, data room
-- document tracking, diligence item checklists, findings/red flags, and
-- Quality of Earnings adjustments.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- dd_assessments — Readiness assessment snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE public.dd_assessments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stage       TEXT        NOT NULL CHECK (stage IN ('seed', 'series_a', 'series_b', 'series_c', 'growth')),
  overall_score INTEGER   NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  items       JSONB       NOT NULL DEFAULT '[]',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_dd_assessments_updated_at
  BEFORE UPDATE ON public.dd_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- dd_items — Due diligence checklist items
-- ---------------------------------------------------------------------------

CREATE TABLE public.dd_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL CHECK (category IN (
                    'corporate', 'financial', 'tax', 'legal',
                    'hr', 'product_tech', 'fundraising'
                  )),
  subcategory     TEXT,
  item_name       TEXT        NOT NULL,
  description     TEXT,
  required_stages TEXT[]      DEFAULT '{}',
  document_type   TEXT        CHECK (document_type IN ('pdf', 'excel', 'csv', 'contract', 'other')),
  status          TEXT        NOT NULL DEFAULT 'not_started'
                  CHECK (status IN ('not_started', 'in_progress', 'complete', 'not_applicable')),
  assignee        TEXT,
  due_date        DATE,
  priority        TEXT        NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  notes           TEXT,
  data_room_path  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_dd_items_updated_at
  BEFORE UPDATE ON public.dd_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- data_room_documents — Virtual data room file registry
-- ---------------------------------------------------------------------------

CREATE TABLE public.data_room_documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folder          TEXT        NOT NULL,
  subfolder       TEXT,
  document_name   TEXT        NOT NULL,
  document_type   TEXT        CHECK (document_type IN ('pdf', 'excel', 'csv', 'contract', 'other')),
  file_path       TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'uploaded', 'verified', 'needs_update')),
  notes           TEXT,
  uploaded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_data_room_documents_updated_at
  BEFORE UPDATE ON public.data_room_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- dd_findings — Red flags and diligence findings
-- ---------------------------------------------------------------------------

CREATE TABLE public.dd_findings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assessment_id   UUID        REFERENCES public.dd_assessments(id) ON DELETE SET NULL,
  category        TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  severity        TEXT        NOT NULL DEFAULT 'observation'
                  CHECK (severity IN ('critical', 'significant', 'moderate', 'observation')),
  impact          TEXT,
  recommendation  TEXT,
  resolved        BOOLEAN     NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_dd_findings_updated_at
  BEFORE UPDATE ON public.dd_findings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- qoe_adjustments — Quality of Earnings adjustments
-- ---------------------------------------------------------------------------

CREATE TABLE public.qoe_adjustments (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID           NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_date     DATE           NOT NULL,
  adjustment_type TEXT           NOT NULL CHECK (adjustment_type IN (
                    'non_recurring', 'non_operating', 'out_of_period',
                    'owner_discretionary', 'related_party', 'run_rate'
                  )),
  description     TEXT           NOT NULL,
  amount          NUMERIC(15, 2) NOT NULL,
  category        TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_qoe_adjustments_updated_at
  BEFORE UPDATE ON public.qoe_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_dd_assessments_company  ON public.dd_assessments (company_id);
CREATE INDEX idx_dd_assessments_stage    ON public.dd_assessments (stage);

CREATE INDEX idx_dd_items_company        ON public.dd_items (company_id);
CREATE INDEX idx_dd_items_category       ON public.dd_items (category);
CREATE INDEX idx_dd_items_status         ON public.dd_items (status);
CREATE INDEX idx_dd_items_priority       ON public.dd_items (priority);

CREATE INDEX idx_dr_docs_company         ON public.data_room_documents (company_id);
CREATE INDEX idx_dr_docs_folder          ON public.data_room_documents (folder);
CREATE INDEX idx_dr_docs_status          ON public.data_room_documents (status);

CREATE INDEX idx_dd_findings_company     ON public.dd_findings (company_id);
CREATE INDEX idx_dd_findings_severity    ON public.dd_findings (severity);
CREATE INDEX idx_dd_findings_resolved    ON public.dd_findings (resolved);

CREATE INDEX idx_qoe_adj_company         ON public.qoe_adjustments (company_id);
CREATE INDEX idx_qoe_adj_period          ON public.qoe_adjustments (period_date);
CREATE INDEX idx_qoe_adj_type            ON public.qoe_adjustments (adjustment_type);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.dd_assessments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dd_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_room_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dd_findings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qoe_adjustments      ENABLE ROW LEVEL SECURITY;

-- dd_assessments policies
CREATE POLICY "dd_assessments_select_owner" ON public.dd_assessments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_assessments_insert_owner" ON public.dd_assessments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_assessments_update_owner" ON public.dd_assessments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_assessments_delete_owner" ON public.dd_assessments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- dd_items policies
CREATE POLICY "dd_items_select_owner" ON public.dd_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_items_insert_owner" ON public.dd_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_items_update_owner" ON public.dd_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_items_delete_owner" ON public.dd_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- data_room_documents policies
CREATE POLICY "dr_docs_select_owner" ON public.data_room_documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dr_docs_insert_owner" ON public.data_room_documents FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dr_docs_update_owner" ON public.data_room_documents FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dr_docs_delete_owner" ON public.data_room_documents FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- dd_findings policies
CREATE POLICY "dd_findings_select_owner" ON public.dd_findings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_findings_insert_owner" ON public.dd_findings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_findings_update_owner" ON public.dd_findings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "dd_findings_delete_owner" ON public.dd_findings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));

-- qoe_adjustments policies
CREATE POLICY "qoe_adj_select_owner" ON public.qoe_adjustments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "qoe_adj_insert_owner" ON public.qoe_adjustments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "qoe_adj_update_owner" ON public.qoe_adjustments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));
CREATE POLICY "qoe_adj_delete_owner" ON public.qoe_adjustments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid()));


-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_assessments       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_items             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_room_documents  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_findings          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qoe_adjustments      TO authenticated;
