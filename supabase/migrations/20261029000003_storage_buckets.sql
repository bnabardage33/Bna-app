-- =============================================================================
-- BNA-APP — MIGRATION 003 : BUCKETS STORAGE (LOGOS & ASSURANCES)
-- =============================================================================

-- Création des buckets s'ils n'existent pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('logos-entreprises', 'logos-entreprises', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('assurances', 'assurances', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS sur storage.objects pour logos-entreprises
-- Structure attendue : {entreprise_id}/logo.{ext}
CREATE POLICY "Logos entreprise lecture publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos-entreprises');

CREATE POLICY "Logos entreprise ecriture restreinte au tenant"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos-entreprises' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = public.get_auth_entreprise_id()::text
  );

CREATE POLICY "Logos entreprise modification restreinte au tenant"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos-entreprises' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = public.get_auth_entreprise_id()::text
  );

-- RLS sur storage.objects pour assurances (Bucket privé)
CREATE POLICY "Assurances lecture restreinte au tenant"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assurances' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = public.get_auth_entreprise_id()::text
  );

CREATE POLICY "Assurances ecriture restreinte au tenant"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assurances' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = public.get_auth_entreprise_id()::text
  );
