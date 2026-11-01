-- =============================================================================
-- BNA-APP — MIGRATION 012 : CALEPINAGES BARDAGE / FAÇADE (MULTI-FAÇADES & OUVERTURES)
-- Migration ADDITIVE. Aucune table existante n'est altérée de manière destructive.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.calepinages_bardage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calepinage_id uuid NOT NULL REFERENCES public.calepinages(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,

  nb_facades integer NOT NULL DEFAULT 1 CHECK (nb_facades >= 1),
  surface_totale_m2 numeric NOT NULL DEFAULT 0 CHECK (surface_totale_m2 >= 0),
  surface_ouvertures_m2 numeric NOT NULL DEFAULT 0 CHECK (surface_ouvertures_m2 >= 0),
  nb_plaques_total integer NOT NULL DEFAULT 0 CHECK (nb_plaques_total >= 0),

  -- Configuration complète des façades et ouvertures (FacadeFormState[])
  facades_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Synthèse calculée du métré global
  resultats_json jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calepinage_id)
);

CREATE INDEX IF NOT EXISTS idx_calepinages_bardage_calepinage
  ON public.calepinages_bardage(calepinage_id);
CREATE INDEX IF NOT EXISTS idx_calepinages_bardage_entreprise
  ON public.calepinages_bardage(entreprise_id);

ALTER TABLE public.calepinages_bardage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calepinages_bardage_select ON public.calepinages_bardage;
CREATE POLICY calepinages_bardage_select ON public.calepinages_bardage
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_bardage_insert ON public.calepinages_bardage;
CREATE POLICY calepinages_bardage_insert ON public.calepinages_bardage
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_bardage_update ON public.calepinages_bardage;
CREATE POLICY calepinages_bardage_update ON public.calepinages_bardage
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_bardage_delete ON public.calepinages_bardage;
CREATE POLICY calepinages_bardage_delete ON public.calepinages_bardage
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());
