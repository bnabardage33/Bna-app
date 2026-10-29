-- =============================================================================
-- BNA-APP — MIGRATION 002 : CLIENTS & CHANTIERS GÉNÉRIQUES (3 MÉTIERS)
-- =============================================================================

-- 1. Table CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  type_client text NOT NULL DEFAULT 'particulier' CHECK (type_client IN ('particulier', 'professionnel')),
  nom text NOT NULL,
  prenom text,
  societe text,
  email text,
  telephone text,
  adresse text,
  code_postal text,
  ville text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_entreprise ON public.clients(entreprise_id);

-- 2. Table CHANTIERS (Strictement générique pour les 3 métiers BNA)
CREATE TABLE IF NOT EXISTS public.chantiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  nom text NOT NULL,
  metier text NOT NULL CHECK (metier IN ('facade', 'terrasse', 'cloture')),
  statut text NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('a_venir', 'en_cours', 'termine', 'en_pause')),
  description text,
  adresse text,
  code_postal text,
  ville text,
  date_debut_prevue date,
  date_fin_prevue date,
  avancement integer NOT NULL DEFAULT 0 CHECK (avancement BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chantiers_entreprise ON public.chantiers(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_client ON public.chantiers(client_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_metier ON public.chantiers(metier);

-- 3. RLS SUR CLIENTS (Isolation multi-tenant stricte)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());

-- 4. RLS SUR CHANTIERS (Isolation multi-tenant stricte)
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chantiers_select ON public.chantiers;
CREATE POLICY chantiers_select ON public.chantiers
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS chantiers_insert ON public.chantiers;
CREATE POLICY chantiers_insert ON public.chantiers
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS chantiers_update ON public.chantiers;
CREATE POLICY chantiers_update ON public.chantiers
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS chantiers_delete ON public.chantiers;
CREATE POLICY chantiers_delete ON public.chantiers
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());
