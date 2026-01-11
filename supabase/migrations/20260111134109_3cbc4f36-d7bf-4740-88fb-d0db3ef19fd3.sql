-- Create maktab_classes table for dynamic class management
CREATE TABLE public.maktab_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  parent_group TEXT,  -- 'A', 'B', 'C' or NULL for main groups
  maktab TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code, maktab)
);

-- Enable RLS
ALTER TABLE public.maktab_classes ENABLE ROW LEVEL SECURITY;

-- Admins can manage classes
CREATE POLICY "Admins can manage maktab classes"
ON public.maktab_classes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view classes
CREATE POLICY "Authenticated users can view maktab classes"
ON public.maktab_classes
FOR SELECT
USING (true);

-- Seed initial data for boys maktab
INSERT INTO public.maktab_classes (code, name, label, parent_group, maktab, display_order) VALUES
  ('A1', 'Group A1', 'Qaidah', 'A', 'boys', 1),
  ('A2', 'Group A2', 'Qaidah', 'A', 'boys', 2),
  ('B', 'Group B', 'Quran', NULL, 'boys', 3),
  ('C', 'Group C', 'Hifz', NULL, 'boys', 4);

-- Seed initial data for girls maktab
INSERT INTO public.maktab_classes (code, name, label, parent_group, maktab, display_order) VALUES
  ('A', 'Group A', 'Qaidah', NULL, 'girls', 1),
  ('B', 'Group B', 'Quran', NULL, 'girls', 2),
  ('C', 'Group C', 'Hifz', NULL, 'girls', 3);

-- Create trigger for updated_at
CREATE TRIGGER update_maktab_classes_updated_at
  BEFORE UPDATE ON public.maktab_classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();