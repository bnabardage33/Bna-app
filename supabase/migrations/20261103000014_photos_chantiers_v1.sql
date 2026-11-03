-- =============================================================================
-- BNA-APP — MIGRATION 014 : BUCKET STORAGE & TABLE PHOTOS CHANTIERS V1
-- Module photos : Constat ou Pointage, stockage cloud et synchronisation multi-postes
-- =============================================================================

-- 1. CRÉATION DU BUCKET STORAGE 'photos-chantiers'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos-chantiers',
  'photos-chantiers',
  true,
  20971520, -- 20 Mo max par cliché
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS sur storage.objects pour photos-chantiers
-- Structure des chemins : {entreprise_id}/{chantier_id}/{photo_id}.{ext}
DROP POLICY IF EXISTS "Photos chantiers lecture publique" ON storage.objects;
CREATE POLICY "Photos chantiers lecture publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos-chantiers');

DROP POLICY IF EXISTS "Photos chantiers ecriture restreinte au tenant" ON storage.objects;
CREATE POLICY "Photos chantiers ecriture restreinte au tenant"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos-chantiers' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = public.get_auth_entreprise_id()::text
  );

DROP POLICY IF EXISTS "Photos chantiers modification restreinte au tenant" ON storage.objects;
CREATE POLICY "Photos chantiers modification restreinte au tenant"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'photos-chantiers' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = public.get_auth_entreprise_id()::text
  );

DROP POLICY IF EXISTS "Photos chantiers suppression restreinte au tenant" ON storage.objects;
CREATE POLICY "Photos chantiers suppression restreinte au tenant"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos-chantiers' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = public.get_auth_entreprise_id()::text
  );

-- 2. TABLE SQL DES MÉTADONNÉES PHOTOS DU CHANTIER
CREATE TABLE IF NOT EXISTS public.photos_chantiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('constat', 'pointage')),
  titre text NOT NULL,
  description text,
  localisation text,
  storage_path text NOT NULL,
  url text NOT NULL,
  date date NOT NULL DEFAULT current_date,
  heure text NOT NULL DEFAULT to_char(now(), 'HH24:MI'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour recherche rapide et affichage par chantier
CREATE INDEX IF NOT EXISTS idx_photos_chantiers_entreprise ON public.photos_chantiers(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_photos_chantiers_chantier ON public.photos_chantiers(chantier_id);
CREATE INDEX IF NOT EXISTS idx_photos_chantiers_type ON public.photos_chantiers(chantier_id, type);
CREATE INDEX IF NOT EXISTS idx_photos_chantiers_date ON public.photos_chantiers(date DESC, created_at DESC);

-- RLS multi-tenant étanche sur la table
ALTER TABLE public.photos_chantiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS photos_chantiers_select ON public.photos_chantiers;
CREATE POLICY photos_chantiers_select ON public.photos_chantiers
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS photos_chantiers_insert ON public.photos_chantiers;
CREATE POLICY photos_chantiers_insert ON public.photos_chantiers
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS photos_chantiers_update ON public.photos_chantiers;
CREATE POLICY photos_chantiers_update ON public.photos_chantiers
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS photos_chantiers_delete ON public.photos_chantiers;
CREATE POLICY photos_chantiers_delete ON public.photos_chantiers
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());
