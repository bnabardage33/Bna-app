-- =============================================================================
-- BNA-APP — MIGRATION 008 : SÉCURISATION DE LA RPC creer_calepinage_terrasse
-- Migration CORRECTIVE ADDITIVE. La migration 007 (déjà appliquée) n'est pas modifiée.
-- NE PAS exécuter automatiquement : à relire puis appliquer manuellement.
-- =============================================================================

-- 1. Unicité de version PAR MÉTIER.
--    La contrainte historique UNIQUE (chantier_id, version) (migration 004) empêcherait
--    d'avoir une V1 Terrasse et une V1 Façade sur un même chantier. Elle est remplacée
--    par UNIQUE (chantier_id, metier, version), strictement moins restrictive.
DO $$
DECLARE
  v_old text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_calepinages_chantier_metier_version'
  ) THEN
    ALTER TABLE public.calepinages
      ADD CONSTRAINT uq_calepinages_chantier_metier_version UNIQUE (chantier_id, metier, version);
  END IF;

  SELECT c.conname INTO v_old
    FROM pg_constraint c
   WHERE c.conrelid = 'public.calepinages'::regclass
     AND c.contype = 'u'
     AND (
       SELECT array_agg(a.attname::text ORDER BY a.attname::text)
         FROM unnest(c.conkey) AS k(attnum)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
     ) = ARRAY['chantier_id', 'version'];

  IF v_old IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.calepinages DROP CONSTRAINT %I', v_old);
  END IF;
END $$;

-- 2. Remplacement de la fonction (même signature que la migration 007)
CREATE OR REPLACE FUNCTION public.creer_calepinage_terrasse(
  p_chantier_id uuid,
  p_details jsonb,
  p_parametres jsonb,
  p_resultats jsonb,
  p_besoins jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_entreprise uuid;
  v_version integer;
  v_cal public.calepinages;
  v_det public.calepinages_terrasse;
  v_besoins jsonb;
  v_key text;
  v_item jsonb;
  v_idx integer := 0;
BEGIN
  -- Session / entreprise
  v_entreprise := public.get_auth_entreprise_id();
  IF v_entreprise IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié ou non rattaché à une entreprise'
      USING ERRCODE = '42501';
  END IF;

  IF p_chantier_id IS NULL THEN
    RAISE EXCEPTION 'Chantier obligatoire' USING ERRCODE = '22023';
  END IF;

  -- Validation de p_details avant toute écriture
  IF p_details IS NULL OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Détails techniques invalides : objet JSON requis' USING ERRCODE = '22023';
  END IF;
  IF p_parametres IS NULL OR jsonb_typeof(p_parametres) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Paramètres invalides : objet JSON requis' USING ERRCODE = '22023';
  END IF;
  IF p_resultats IS NULL OR jsonb_typeof(p_resultats) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Résultats invalides : objet JSON requis' USING ERRCODE = '22023';
  END IF;

  -- Nombres strictement positifs
  FOREACH v_key IN ARRAY ARRAY[
    'longueur_m', 'largeur_m', 'largeur_lame_mm', 'longueur_lame_m',
    'entraxe_lambourdes_cm', 'entraxe_plots_cm',
    'surface_m2', 'ml_lames', 'ml_lambourdes',
    'nb_lames', 'nb_lambourdes', 'nb_plots', 'nb_fixations'
  ] LOOP
    IF jsonb_typeof(p_details -> v_key) IS DISTINCT FROM 'number'
       OR (p_details ->> v_key)::numeric <= 0 THEN
      RAISE EXCEPTION 'Paramètre technique invalide ou manquant : % (nombre strictement positif requis)', v_key
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Quantités entières
  FOREACH v_key IN ARRAY ARRAY['nb_lames', 'nb_lambourdes', 'nb_plots', 'nb_fixations'] LOOP
    IF (p_details ->> v_key)::numeric <> trunc((p_details ->> v_key)::numeric) THEN
      RAISE EXCEPTION 'Paramètre technique invalide : % (entier requis)', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Nombres positifs ou nuls
  FOREACH v_key IN ARRAY ARRAY['espace_inter_lames_mm', 'marge_chutes_pct'] LOOP
    IF jsonb_typeof(p_details -> v_key) IS DISTINCT FROM 'number'
       OR (p_details ->> v_key)::numeric < 0 THEN
      RAISE EXCEPTION 'Paramètre technique invalide ou manquant : % (valeur >= 0 requise)', v_key
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Énumérations
  IF jsonb_typeof(p_details -> 'orientation_lames') IS DISTINCT FROM 'string'
     OR (p_details ->> 'orientation_lames') NOT IN ('longueur', 'largeur') THEN
    RAISE EXCEPTION 'orientation_lames invalide : longueur ou largeur requis' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_details -> 'type_fixation') IS DISTINCT FROM 'string'
     OR (p_details ->> 'type_fixation') NOT IN ('vis', 'clips') THEN
    RAISE EXCEPTION 'type_fixation invalide : vis ou clips requis' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_details -> 'disposition_joints') IS DISTINCT FROM 'string'
     OR (p_details ->> 'disposition_joints') IS DISTINCT FROM 'alignes' THEN
    RAISE EXCEPTION 'Les joints en quinconce ne sont pas encore disponibles dans Terrasse V1.1.'
      USING ERRCODE = '22023';
  END IF;

  -- Validation de chaque besoin
  IF p_besoins IS NULL OR jsonb_typeof(p_besoins) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_besoins) = 0 THEN
    RAISE EXCEPTION 'Liste de besoins matériaux invalide : tableau non vide requis' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_besoins) LOOP
    v_idx := v_idx + 1;
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Besoin #% invalide : objet JSON requis', v_idx USING ERRCODE = '22023';
    END IF;
    FOREACH v_key IN ARRAY ARRAY['categorie', 'designation', 'unite'] LOOP
      IF jsonb_typeof(v_item -> v_key) IS DISTINCT FROM 'string'
         OR btrim(v_item ->> v_key) = '' THEN
        RAISE EXCEPTION 'Besoin #% invalide : % obligatoire et non vide', v_idx, v_key
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF jsonb_typeof(v_item -> 'quantite') IS DISTINCT FROM 'number'
       OR (v_item ->> 'quantite')::numeric <= 0 THEN
      RAISE EXCEPTION 'Besoin #% invalide : quantite strictement positive requise', v_idx
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Verrou transactionnel par chantier (pas de course sur le calcul de version)
  PERFORM pg_advisory_xact_lock(hashtextextended(p_chantier_id::text, 0));

  PERFORM 1 FROM public.chantiers
   WHERE id = p_chantier_id AND entreprise_id = v_entreprise;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chantier introuvable ou non autorisé' USING ERRCODE = '42501';
  END IF;

  -- Version calculée par chantier, entreprise ET métier
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
    FROM public.calepinages
   WHERE chantier_id = p_chantier_id
     AND entreprise_id = v_entreprise
     AND metier = 'terrasse';

  -- Archivage de l'ancienne version ; annulation des seuls besoins 'a_commander'
  -- (les besoins 'commande' et 'recu' sont conservés tels quels)
  WITH archives AS (
    UPDATE public.calepinages
       SET statut = 'archive', updated_at = now()
     WHERE chantier_id = p_chantier_id
       AND entreprise_id = v_entreprise
       AND metier = 'terrasse'
       AND statut = 'valide'
    RETURNING id
  )
  UPDATE public.besoins_materiaux b
     SET statut = 'annule', updated_at = now()
    FROM archives a
   WHERE b.calepinage_id = a.id
     AND b.entreprise_id = v_entreprise
     AND b.origine = 'calepinage'
     AND b.statut = 'a_commander';

  INSERT INTO public.calepinages (entreprise_id, chantier_id, metier, version, statut, created_by)
  VALUES (v_entreprise, p_chantier_id, 'terrasse', v_version, 'valide', auth.uid())
  RETURNING * INTO v_cal;

  INSERT INTO public.calepinages_terrasse (
    calepinage_id, entreprise_id,
    longueur_m, largeur_m, orientation_lames,
    largeur_lame_mm, longueur_lame_m, espace_inter_lames_mm,
    entraxe_lambourdes_cm, entraxe_plots_cm, type_fixation, marge_chutes_pct,
    surface_m2, ml_lames, nb_lames, ml_lambourdes, nb_lambourdes, nb_plots, nb_fixations,
    disposition_joints, parametres, resultats
  ) VALUES (
    v_cal.id, v_entreprise,
    (p_details->>'longueur_m')::numeric, (p_details->>'largeur_m')::numeric,
    p_details->>'orientation_lames',
    (p_details->>'largeur_lame_mm')::numeric, (p_details->>'longueur_lame_m')::numeric,
    (p_details->>'espace_inter_lames_mm')::numeric,
    (p_details->>'entraxe_lambourdes_cm')::numeric, (p_details->>'entraxe_plots_cm')::numeric,
    p_details->>'type_fixation', (p_details->>'marge_chutes_pct')::numeric,
    (p_details->>'surface_m2')::numeric, (p_details->>'ml_lames')::numeric,
    (p_details->>'nb_lames')::integer, (p_details->>'ml_lambourdes')::numeric,
    (p_details->>'nb_lambourdes')::integer, (p_details->>'nb_plots')::integer,
    (p_details->>'nb_fixations')::integer,
    p_details->>'disposition_joints', p_parametres, p_resultats
  )
  RETURNING * INTO v_det;

  INSERT INTO public.besoins_materiaux (
    entreprise_id, chantier_id, calepinage_id, categorie, designation, unite, quantite, origine, statut
  )
  SELECT v_entreprise, p_chantier_id, v_cal.id,
         btrim(x.categorie), btrim(x.designation), btrim(x.unite), x.quantite,
         'calepinage', 'a_commander'
    FROM jsonb_to_recordset(p_besoins)
      AS x(categorie text, designation text, unite text, quantite numeric);

  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.created_at, b.categorie), '[]'::jsonb)
    INTO v_besoins
    FROM public.besoins_materiaux b WHERE b.calepinage_id = v_cal.id;

  RETURN jsonb_build_object(
    'calepinage', to_jsonb(v_cal),
    'details', to_jsonb(v_det),
    'besoins', v_besoins
  );
END;
$$;

REVOKE ALL ON FUNCTION public.creer_calepinage_terrasse(uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.creer_calepinage_terrasse(uuid, jsonb, jsonb, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.creer_calepinage_terrasse(uuid, jsonb, jsonb, jsonb, jsonb) TO authenticated;

-- =============================================================================
-- 3. REQUÊTES D'AUDIT (COMMENTÉES) — à exécuter manuellement, résultat attendu : 0 ligne
-- =============================================================================

-- 3.1 Doublons de détails Terrasse par calepinage
-- SELECT calepinage_id, count(*) AS nb
--   FROM public.calepinages_terrasse
--  GROUP BY calepinage_id
-- HAVING count(*) > 1;

-- 3.2 Plusieurs versions valides par chantier et métier
-- SELECT chantier_id, metier, count(*) AS nb_valides
--   FROM public.calepinages
--  WHERE statut = 'valide'
--  GROUP BY chantier_id, metier
-- HAVING count(*) > 1;

-- 3.3 Incohérences d'entreprise
-- 3.3.a calepinage <-> chantier
-- SELECT c.id AS calepinage_id, c.entreprise_id AS ent_calepinage, ch.entreprise_id AS ent_chantier
--   FROM public.calepinages c
--   JOIN public.chantiers ch ON ch.id = c.chantier_id
--  WHERE c.entreprise_id <> ch.entreprise_id;

-- 3.3.b détail Terrasse <-> calepinage
-- SELECT t.id AS detail_id, t.entreprise_id AS ent_detail, c.entreprise_id AS ent_calepinage
--   FROM public.calepinages_terrasse t
--   JOIN public.calepinages c ON c.id = t.calepinage_id
--  WHERE t.entreprise_id <> c.entreprise_id;

-- 3.3.c besoin <-> chantier
-- SELECT b.id AS besoin_id, b.entreprise_id AS ent_besoin, ch.entreprise_id AS ent_chantier
--   FROM public.besoins_materiaux b
--   JOIN public.chantiers ch ON ch.id = b.chantier_id
--  WHERE b.entreprise_id <> ch.entreprise_id;

-- 3.3.d besoin <-> calepinage (entreprise ou chantier divergents)
-- SELECT b.id AS besoin_id, b.entreprise_id AS ent_besoin, c.entreprise_id AS ent_calepinage,
--        b.chantier_id AS chantier_besoin, c.chantier_id AS chantier_calepinage
--   FROM public.besoins_materiaux b
--   JOIN public.calepinages c ON c.id = b.calepinage_id
--  WHERE b.entreprise_id <> c.entreprise_id OR b.chantier_id <> c.chantier_id;

-- =============================================================================
-- 4. VALIDATION DES CONTRAINTES DE LA MIGRATION 007 (COMMENTÉE)
--    À exécuter UNIQUEMENT après audit des données réelles (section 3 : 0 ligne partout).
-- =============================================================================

-- ALTER TABLE public.calepinages
--   VALIDATE CONSTRAINT fk_calepinages_chantier_entreprise;
-- ALTER TABLE public.calepinages_terrasse
--   VALIDATE CONSTRAINT fk_calepinages_terrasse_calepinage_entreprise;
-- ALTER TABLE public.besoins_materiaux
--   VALIDATE CONSTRAINT fk_besoins_chantier_entreprise;
-- ALTER TABLE public.besoins_materiaux
--   VALIDATE CONSTRAINT fk_besoins_calepinage_entreprise;
