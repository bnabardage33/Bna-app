-- =============================================================================
-- BNA-APP — MIGRATION 011 : SUPPRESSION DÉFINITIVE CHANTIERS EN CASCADE
-- Permet la purge complète d'un chantier depuis la corbeille sans blocage FK
-- =============================================================================

-- 1. Table CALEPINAGES : Suppression en cascade si le chantier parent est supprimé
ALTER TABLE public.calepinages
  DROP CONSTRAINT IF EXISTS calepinages_chantier_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_calepinages_chantier_entreprise;

ALTER TABLE public.calepinages
  ADD CONSTRAINT calepinages_chantier_id_fkey
  FOREIGN KEY (chantier_id)
  REFERENCES public.chantiers(id)
  ON DELETE CASCADE;

-- 2. Table BESOINS_MATERIAUX : Suppression en cascade si le chantier parent est supprimé
ALTER TABLE public.besoins_materiaux
  DROP CONSTRAINT IF EXISTS besoins_materiaux_chantier_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_besoins_chantier_entreprise;

ALTER TABLE public.besoins_materiaux
  ADD CONSTRAINT besoins_materiaux_chantier_id_fkey
  FOREIGN KEY (chantier_id)
  REFERENCES public.chantiers(id)
  ON DELETE CASCADE;

-- 3. Table COMMANDES_FOURNISSEURS : Suppression en cascade si le chantier parent est supprimé
ALTER TABLE public.commandes_fournisseurs
  DROP CONSTRAINT IF EXISTS commandes_fournisseurs_chantier_id_fkey;

ALTER TABLE public.commandes_fournisseurs
  ADD CONSTRAINT commandes_fournisseurs_chantier_id_fkey
  FOREIGN KEY (chantier_id)
  REFERENCES public.chantiers(id)
  ON DELETE CASCADE;
