-- =============================================================================
-- Financial Research Assistant — sessions and iterations
-- =============================================================================

CREATE TABLE public.research_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'completed', 'archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rs_user_id ON public.research_sessions (user_id);
CREATE INDEX idx_rs_created_at ON public.research_sessions (user_id, created_at DESC);

ALTER TABLE public.research_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rs_select_owner" ON public.research_sessions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "rs_insert_owner" ON public.research_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "rs_update_owner" ON public.research_sessions FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "rs_delete_owner" ON public.research_sessions FOR DELETE
  USING (user_id = auth.uid());


CREATE TABLE public.research_iterations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID        NOT NULL REFERENCES public.research_sessions(id) ON DELETE CASCADE,
  iteration_num  INTEGER     NOT NULL,
  user_prompt    TEXT        NOT NULL,
  generated_prompt TEXT,
  result_markdown TEXT,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  latency_ms     INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_session_iteration UNIQUE (session_id, iteration_num),
  CONSTRAINT max_iterations CHECK (iteration_num BETWEEN 1 AND 10)
);

CREATE INDEX idx_ri_session_id ON public.research_iterations (session_id, iteration_num);

ALTER TABLE public.research_iterations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ri_select_owner" ON public.research_iterations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.research_sessions rs
      WHERE rs.id = session_id AND rs.user_id = auth.uid()
    )
  );
CREATE POLICY "ri_insert_owner" ON public.research_iterations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.research_sessions rs
      WHERE rs.id = session_id AND rs.user_id = auth.uid()
    )
  );
CREATE POLICY "ri_update_owner" ON public.research_iterations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.research_sessions rs
      WHERE rs.id = session_id AND rs.user_id = auth.uid()
    )
  );
