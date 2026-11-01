-- =============================================================================
-- BNA-APP — MIGRATION 013 : RENDEZ-VOUS & PLANNING V1
-- Table pour les rendez-vous clients, visites techniques et réunions chantier
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.rendez_vous (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  titre text NOT NULL,
  nature text NOT NULL,
  date date NOT NULL,
  heure_debut text NOT NULL DEFAULT '09:00',
  heure_fin text,
  lieu text,
  statut text NOT NULL DEFAULT 'planifie' CHECK (statut IN ('planifie', 'confirme', 'effectue', 'annule')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rendez_vous_entreprise ON public.rendez_vous(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_rendez_vous_chantier ON public.rendez_vous(chantier_id);
CREATE INDEX IF NOT EXISTS idx_rendez_vous_date ON public.rendez_vous(date);

-- RLS multi-tenant étanche
ALTER TABLE public.rendez_vous ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rdv_select ON public.rendez_vous;
CREATE POLICY rdv_select ON public.rendez_vous
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS rdv_insert ON public.rendez_vous;
CREATE POLICY rdv_insert ON public.rendez_vous
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS rdv_update ON public.rendez_vous;
CREATE POLICY rdv_update ON public.rendez_vous
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS rdv_delete ON public.rendez_vous;
CREATE POLICY rdv_delete ON public.rendez_vous
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());
