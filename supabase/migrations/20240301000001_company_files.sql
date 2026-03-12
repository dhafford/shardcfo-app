-- =============================================================================
-- Company Files — file upload & management
-- =============================================================================

-- ---------------------------------------------------------------------------
-- company_files table
-- ---------------------------------------------------------------------------

CREATE TABLE public.company_files (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name    TEXT        NOT NULL,
  file_size    BIGINT      NOT NULL DEFAULT 0,
  mime_type    TEXT,
  category     TEXT        NOT NULL DEFAULT 'other'
               CHECK (category IN ('historicals', 'projections', 'board_materials', 'investment_memorandum', 'other')),
  storage_path TEXT        NOT NULL,
  uploaded_by  UUID        REFERENCES public.profiles(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_company_files_updated_at
  BEFORE UPDATE ON public.company_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_cf_company_id ON public.company_files (company_id);
CREATE INDEX idx_cf_category   ON public.company_files (company_id, category);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.company_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf_select_owner"
  ON public.company_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "cf_insert_owner"
  ON public.company_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "cf_update_owner"
  ON public.company_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "cf_delete_owner"
  ON public.company_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Supabase Storage bucket (private, 50MB limit)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-files',
  'company-files',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — scoped by company ownership
CREATE POLICY "cf_storage_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-files'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "cf_storage_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'company-files'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "cf_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'company-files'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = (storage.foldername(name))[1]::uuid
        AND c.owner_id = auth.uid()
    )
  );
