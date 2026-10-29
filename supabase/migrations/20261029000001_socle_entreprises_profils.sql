-- =============================================================================
-- BNA-APP — MIGRATION 001 : SOCLE AUTH & MULTI-ENTREPRISE
-- =============================================================================

-- 1. Table ENTREPRISES
CREATE TABLE IF NOT EXISTS public.entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  nom_commercial text,
  adresse text,
  code_postal text,
  ville text,
  telephone text,
  email text,
  siret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Table PROFILS (reliée à auth.users)
CREATE TABLE IF NOT EXISTS public.profils (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  prenom text NOT NULL DEFAULT '',
  nom text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'dirigeant' CHECK (role IN ('dirigeant', 'chantier', 'commercial', 'administratif')),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profils_entreprise ON public.profils(entreprise_id);

-- 3. Fonction de sécurité d'isolation de tenant
CREATE OR REPLACE FUNCTION public.get_auth_entreprise_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT entreprise_id FROM public.profils WHERE id = auth.uid() AND actif = true LIMIT 1;
$$;

-- 4. RLS SUR ENTREPRISES
ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entreprises_select ON public.entreprises;
CREATE POLICY entreprises_select ON public.entreprises
  FOR SELECT USING (id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS entreprises_insert ON public.entreprises;
CREATE POLICY entreprises_insert ON public.entreprises
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS entreprises_update ON public.entreprises;
CREATE POLICY entreprises_update ON public.entreprises
  FOR UPDATE USING (id = public.get_auth_entreprise_id())
  WITH CHECK (id = public.get_auth_entreprise_id());

-- 5. RLS SUR PROFILS
ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profils_select ON public.profils;
CREATE POLICY profils_select ON public.profils
  FOR SELECT USING (
    id = auth.uid() OR entreprise_id = public.get_auth_entreprise_id()
  );

DROP POLICY IF EXISTS profils_insert ON public.profils;
CREATE POLICY profils_insert ON public.profils
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profils_update ON public.profils;
CREATE POLICY profils_update ON public.profils
  FOR UPDATE USING (
    id = auth.uid() OR (
      entreprise_id = public.get_auth_entreprise_id() AND
      EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND role = 'dirigeant')
    )
  );
