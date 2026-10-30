-- =============================================================================
-- BNA-APP — MIGRATION 007 : TERRASSE V1.1 — VERSIONNEMENT ATOMIQUE & COHÉRENCE TENANT
-- Migration ADDITIVE. Aucune migration existante n'est modifiée.
-- NE PAS exécuter automatiquement : à appliquer manuellement après relecture.
-- =============================================================================

-- 1. Nouvelles colonnes (additives) sur calepinages_terrasse
ALTER TABLE public.calepinages_terrasse
  ADD COLUMN IF NOT EXISTS disposition_joints text NOT NULL DEFAULT 'alignes',
  ADD COLUMN IF NOT EXISTS parametres jsonb,
  ADD COLUMN IF NOT EXISTS resultats jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_calepinages_terrasse_disposition_joints'
  ) THEN
    ALTER TABLE public.calepinages_terrasse
      ADD CONSTRAINT chk_calepinages_terrasse_disposition_joints
      CHECK (disposition_joints IN ('alignes', 'quinconce'));
  END IF;
END $$;

-- 2. Un seul détail Terrasse par calepinage, une seule version 'valide' par chantier/métier
CREATE UNIQUE INDEX IF NOT EXISTS uq_calepinages_terrasse_calepinage
  ON public.calepinages_terrasse(calepinage_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_calepinages_valide_par_chantier_metier
  ON public.calepinages(chantier_id, metier)
  WHERE statut = 'valide';

-- 3. Cohérence multi-tenant : clés composites (id, entreprise_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_chantiers_id_entreprise') THEN
    ALTER TABLE public.chantiers
      ADD CONSTRAINT uq_chantiers_id_entreprise UNIQUE (id, entreprise_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_calepinages_id_entreprise') THEN
    ALTER TABLE public.calepinages
      ADD CONSTRAINT uq_calepinages_id_entreprise UNIQUE (id, entreprise_id);
  END IF;
END $$;

-- Les FK composites sont créées NOT VALID : elles s'appliquent immédiatement aux
-- nouvelles lignes sans bloquer sur d'éventuelles données historiques.
-- Après contrôle des données existantes, exécuter manuellement :
--   ALTER TABLE public.<table> VALIDATE CONSTRAINT <nom>;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_calepinages_chantier_entreprise') THEN
    ALTER TABLE public.calepinages
      ADD CONSTRAINT fk_calepinages_chantier_entreprise
      FOREIGN KEY (chantier_id, entreprise_id)
      REFERENCES public.chantiers(id, entreprise_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_calepinages_terrasse_calepinage_entreprise') THEN
    ALTER TABLE public.calepinages_terrasse
      ADD CONSTRAINT fk_calepinages_terrasse_calepinage_entreprise
      FOREIGN KEY (calepinage_id, entreprise_id)
      REFERENCES public.calepinages(id, entreprise_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_besoins_chantier_entreprise') THEN
    ALTER TABLE public.besoins_materiaux
      ADD CONSTRAINT fk_besoins_chantier_entreprise
      FOREIGN KEY (chantier_id, entreprise_id)
      REFERENCES public.chantiers(id, entreprise_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_besoins_calepinage_entreprise') THEN
    ALTER TABLE public.besoins_materiaux
      ADD CONSTRAINT fk_besoins_calepinage_entreprise
      FOREIGN KEY (calepinage_id, entreprise_id)
      REFERENCES public.calepinages(id, entreprise_id)
      ON DELETE SET NULL (calepinage_id)
      NOT VALID;
  END IF;
END $$;

-- 4. Création atomique d'une nouvelle version de calepinage Terrasse
--    - SECURITY INVOKER : les politiques RLS restent appliquées ;
--    - l'entreprise est déduite de la session (jamais fournie par le client) ;
--    - verrou consultatif par chantier : pas de course sur max(version) + 1 ;
--    - ancienne version 'valide' -> 'archive' ;
--    - besoins 'a_commander' de l'ancienne version -> 'annule' (historique conservé) ;
--      les besoins déjà 'commande' ou 'recu' ne sont pas modifiés ;
--    - tout est exécuté dans la transaction de l'appel : échec = rollback complet.
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
BEGIN
  v_entreprise := public.get_auth_entreprise_id();
  IF v_entreprise IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié ou non rattaché à une entreprise'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_chantier_id::text, 0));

  PERFORM 1 FROM public.chantiers
   WHERE id = p_chantier_id AND entreprise_id = v_entreprise;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chantier introuvable ou non autorisé' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_besoins) IS DISTINCT FROM 'array' OR jsonb_array_length(p_besoins) = 0 THEN
    RAISE EXCEPTION 'Liste de besoins matériaux invalide' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
    FROM public.calepinages WHERE chantier_id = p_chantier_id;

  -- Archivage de l'ancienne version et désactivation de ses besoins non commandés
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
    COALESCE(p_details->>'orientation_lames', 'longueur'),
    (p_details->>'largeur_lame_mm')::numeric, (p_details->>'longueur_lame_m')::numeric,
    (p_details->>'espace_inter_lames_mm')::numeric,
    (p_details->>'entraxe_lambourdes_cm')::numeric, (p_details->>'entraxe_plots_cm')::numeric,
    p_details->>'type_fixation', (p_details->>'marge_chutes_pct')::numeric,
    (p_details->>'surface_m2')::numeric, (p_details->>'ml_lames')::numeric,
    (p_details->>'nb_lames')::integer, (p_details->>'ml_lambourdes')::numeric,
    (p_details->>'nb_lambourdes')::integer, (p_details->>'nb_plots')::integer,
    (p_details->>'nb_fixations')::integer,
    COALESCE(p_details->>'disposition_joints', 'alignes'), p_parametres, p_resultats
  )
  RETURNING * INTO v_det;

  INSERT INTO public.besoins_materiaux (
    entreprise_id, chantier_id, calepinage_id, categorie, designation, unite, quantite, origine, statut
  )
  SELECT v_entreprise, p_chantier_id, v_cal.id, x.categorie, x.designation, x.unite, x.quantite,
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
