-- =============================================================================
-- BNA-APP — MIGRATION 005 : CLIENTS ADDITIFS, CONTACTS CLIENTS & CHANTIERS
-- =============================================================================

-- 1. EXTENSIONS TABLE CLIENTS
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS telephone_secondaire text,
  ADD COLUMN IF NOT EXISTS adresse_complement text,
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS nom_commercial text;

-- Contrainte d'unicité (id, entreprise_id) pour autoriser les FK composites strictes multi-tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_clients_id_entreprise'
  ) THEN
    ALTER TABLE public.clients ADD CONSTRAINT uq_clients_id_entreprise UNIQUE (id, entreprise_id);
  END IF;
END $$;

-- 2. TABLE CONTACTS_CLIENTS (Multi-contacts par client avec isolation tenant stricte)
CREATE TABLE IF NOT EXISTS public.contacts_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  nom text NOT NULL,
  prenom text,
  fonction text,
  telephone text,
  email text,
  est_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Verrouillage relationnel multi-tenant strict : client_id et entreprise_id doivent concorder
  CONSTRAINT fk_contacts_clients_client_entreprise
    FOREIGN KEY (client_id, entreprise_id)
    REFERENCES public.clients(id, entreprise_id)
    ON DELETE CASCADE,
  -- Clé composite pour les FK pointant vers un contact précis d'un client précis
  CONSTRAINT uq_contacts_clients_id_client_entreprise
    UNIQUE (id, client_id, entreprise_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_clients_entreprise ON public.contacts_clients(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_contacts_clients_client ON public.contacts_clients(client_id);

-- Unicité du contact principal par client (au maximum un seul est_principal = true par client)
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_clients_principal_unique
  ON public.contacts_clients(client_id)
  WHERE (est_principal = true);

-- RLS SUR CONTACTS_CLIENTS
ALTER TABLE public.contacts_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_clients_select ON public.contacts_clients;
CREATE POLICY contacts_clients_select ON public.contacts_clients
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS contacts_clients_insert ON public.contacts_clients;
CREATE POLICY contacts_clients_insert ON public.contacts_clients
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS contacts_clients_update ON public.contacts_clients;
CREATE POLICY contacts_clients_update ON public.contacts_clients
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS contacts_clients_delete ON public.contacts_clients;
CREATE POLICY contacts_clients_delete ON public.contacts_clients
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());

-- Trigger updated_at pour contacts_clients
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacts_clients_updated_at ON public.contacts_clients;
CREATE TRIGGER trg_contacts_clients_updated_at
  BEFORE UPDATE ON public.contacts_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. EXTENSIONS TABLE CHANTIERS
ALTER TABLE public.chantiers
  ADD COLUMN IF NOT EXISTS adresse_complement text,
  ADD COLUMN IF NOT EXISTS contact_id uuid;

CREATE INDEX IF NOT EXISTS idx_chantiers_contact
  ON public.chantiers(contact_id);

-- Verrouillage relationnel multi-tenant strict du contact chantier :
-- Le contact_id doit obligatoirement appartenir au MÊME client_id et à la MÊME entreprise_id.
-- En cas de suppression du contact, SEUL contact_id est mis à NULL (client_id et entreprise_id restent inchangés).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_chantiers_contact_client_entreprise'
  ) THEN
    ALTER TABLE public.chantiers
      ADD CONSTRAINT fk_chantiers_contact_client_entreprise
      FOREIGN KEY (contact_id, client_id, entreprise_id)
      REFERENCES public.contacts_clients(id, client_id, entreprise_id)
      ON DELETE SET NULL (contact_id);
  END IF;
END $$;
