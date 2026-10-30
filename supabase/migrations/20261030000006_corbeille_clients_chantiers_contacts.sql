-- =============================================================================
-- BNA-APP — MIGRATION 006 : CORBEILLE SÉCURISÉE (SOFT DELETE) CLIENTS, CHANTIERS, CONTACTS
-- =============================================================================

-- 1. COLONNES CORBEILLE SUR CLIENTS
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients(deleted_at);

-- 2. COLONNES CORBEILLE SUR CONTACTS_CLIENTS
ALTER TABLE public.contacts_clients
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_clients_deleted_at ON public.contacts_clients(deleted_at);

-- Remplacement de l'index unique du contact principal :
-- Garantit au maximum UN contact principal NON SUPPRIMÉ par client
DROP INDEX IF EXISTS public.uq_contacts_clients_principal_unique;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_clients_principal_unique
  ON public.contacts_clients(client_id)
  WHERE est_principal = true AND deleted_at IS NULL;

-- 3. COLONNES CORBEILLE SUR CHANTIERS
ALTER TABLE public.chantiers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chantiers_deleted_at ON public.chantiers(deleted_at);

-- 4. POLITIQUES RLS RENFORCÉES POUR LA SUPPRESSION DÉFINITIVE (HARD DELETE)
-- Seul le profil avec rôle 'dirigeant' au sein de la même entreprise peut supprimer définitivement.

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients
  FOR DELETE USING (
    entreprise_id = public.get_auth_entreprise_id() AND
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid() AND role = 'dirigeant' AND actif = true
    )
  );

DROP POLICY IF EXISTS chantiers_delete ON public.chantiers;
CREATE POLICY chantiers_delete ON public.chantiers
  FOR DELETE USING (
    entreprise_id = public.get_auth_entreprise_id() AND
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid() AND role = 'dirigeant' AND actif = true
    )
  );

DROP POLICY IF EXISTS contacts_clients_delete ON public.contacts_clients;
CREATE POLICY contacts_clients_delete ON public.contacts_clients
  FOR DELETE USING (
    entreprise_id = public.get_auth_entreprise_id() AND
    EXISTS (
      SELECT 1 FROM public.profils
      WHERE id = auth.uid() AND role = 'dirigeant' AND actif = true
    )
  );
