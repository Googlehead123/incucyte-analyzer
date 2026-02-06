-- Create experiments table for saved analyses
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT,
  conditions JSONB NOT NULL DEFAULT '[]',
  raw_data JSONB NOT NULL DEFAULT '{}',
  timepoints JSONB NOT NULL DEFAULT '[]',
  excluded_wells JSONB DEFAULT '[]',
  processed_data JSONB,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

-- Users can CRUD their own experiments
CREATE POLICY "Users can view own experiments"
  ON public.experiments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own experiments"
  ON public.experiments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own experiments"
  ON public.experiments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own experiments"
  ON public.experiments FOR DELETE
  USING (user_id = auth.uid());

-- Index for faster user queries
CREATE INDEX idx_experiments_user_id ON public.experiments(user_id);
CREATE INDEX idx_experiments_created_at ON public.experiments(created_at DESC);
