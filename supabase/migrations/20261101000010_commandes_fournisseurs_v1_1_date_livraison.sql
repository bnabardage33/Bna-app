-- =============================================================================
-- BNA-APP — MIGRATION 010 : COMMANDES FOURNISSEURS V1.1
-- Ajout de la date de livraison souhaitée (texte libre / créneau : ex. "05/11/2026 matin")
-- =============================================================================

-- 1. Ajout de la colonne sur la table commandes_fournisseurs
ALTER TABLE public.commandes_fournisseurs
  ADD COLUMN IF NOT EXISTS date_livraison_souhaitee text;

-- 2. Mise à jour de la fonction RPC creer_commande_fournisseur avec le paramètre p_date_livraison_souhaitee
CREATE OR REPLACE FUNCTION public.creer_commande_fournisseur(
  p_chantier_id uuid,
  p_fournisseur_id uuid,
  p_version_source_id uuid,
  p_lignes jsonb,
  p_commentaire text DEFAULT NULL,
  p_reference_fournisseur text DEFAULT NULL,
  p_date_livraison_souhaitee text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_entreprise_id uuid;
  v_annee integer;
  v_seq integer;
  v_numero_commande text;
  v_version_numero integer := NULL;
  v_commande_id uuid;
  v_ligne jsonb;
  v_designation text;
  v_categorie text;
  v_unite text;
  v_quantite numeric;
  v_besoin_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Récupération de l'entreprise
  v_entreprise_id := public.get_auth_entreprise_id();
  IF v_entreprise_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié ou non rattaché à une entreprise'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validation du chantier
  IF NOT EXISTS (
    SELECT 1 FROM public.chantiers
    WHERE id = p_chantier_id AND entreprise_id = v_entreprise_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Chantier introuvable ou non autorisé'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Validation du fournisseur
  IF NOT EXISTS (
    SELECT 1 FROM public.fournisseurs
    WHERE id = p_fournisseur_id AND entreprise_id = v_entreprise_id
  ) THEN
    RAISE EXCEPTION 'Fournisseur introuvable ou non autorisé'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Validation des lignes
  IF p_lignes IS NULL OR jsonb_array_length(p_lignes) = 0 THEN
    RAISE EXCEPTION 'La commande doit comporter au moins une ligne'
      USING ERRCODE = '22023';
  END IF;

  -- 5. Résolution de la version source si fournie
  IF p_version_source_id IS NOT NULL THEN
    SELECT version INTO v_version_numero
    FROM public.calepinages
    WHERE id = p_version_source_id AND entreprise_id = v_entreprise_id;
  END IF;

  -- 6. Génération atomique du numéro CMD-YYYY-XXXX (verrouillage ligne anti-collision)
  v_annee := EXTRACT(YEAR FROM now())::integer;

  INSERT INTO public.compteurs_numerotation (entreprise_id, type_document, annee, dernier_numero)
  VALUES (v_entreprise_id, 'commande_fournisseur', v_annee, 1)
  ON CONFLICT (entreprise_id, type_document, annee)
  DO UPDATE SET dernier_numero = public.compteurs_numerotation.dernier_numero + 1
  RETURNING dernier_numero INTO v_seq;

  v_numero_commande := 'CMD-' || v_annee::text || '-' || lpad(v_seq::text, 4, '0');

  -- 7. Insertion de l'en-tête de commande
  INSERT INTO public.commandes_fournisseurs (
    entreprise_id,
    chantier_id,
    fournisseur_id,
    version_source_id,
    version_source_numero,
    numero_commande,
    statut,
    date_commande,
    commentaire,
    reference_fournisseur,
    date_livraison_souhaitee
  ) VALUES (
    v_entreprise_id,
    p_chantier_id,
    p_fournisseur_id,
    p_version_source_id,
    v_version_numero,
    v_numero_commande,
    'brouillon',
    now(),
    p_commentaire,
    p_reference_fournisseur,
    p_date_livraison_souhaitee
  )
  RETURNING id INTO v_commande_id;

  -- 8. Insertion des lignes de commande (Snapshot figé)
  FOR v_ligne IN SELECT * FROM jsonb_array_elements(p_lignes)
  LOOP
    v_designation := trim(COALESCE(v_ligne->>'designation', ''));
    v_categorie := trim(COALESCE(v_ligne->>'categorie', 'autre'));
    v_unite := trim(COALESCE(v_ligne->>'unite', 'u'));
    v_quantite := (v_ligne->>'quantite')::numeric;

    IF char_length(v_designation) = 0 THEN
      RAISE EXCEPTION 'Désignation de ligne obligatoire' USING ERRCODE = '22023';
    END IF;
    IF v_quantite IS NULL OR v_quantite < 0 THEN
      RAISE EXCEPTION 'Quantité invalide pour la ligne %', v_designation USING ERRCODE = '22023';
    END IF;

    IF v_ligne ? 'besoin_source_id' AND (v_ligne->>'besoin_source_id') IS NOT NULL AND (v_ligne->>'besoin_source_id') <> '' THEN
      v_besoin_id := (v_ligne->>'besoin_source_id')::uuid;
    ELSE
      v_besoin_id := NULL;
    END IF;

    INSERT INTO public.lignes_commande_fournisseur (
      commande_id,
      besoin_source_id,
      designation,
      categorie,
      unite,
      quantite
    ) VALUES (
      v_commande_id,
      v_besoin_id,
      v_designation,
      v_categorie,
      v_unite,
      v_quantite
    );
  END LOOP;

  -- 9. Construction de la réponse JSON complète
  SELECT jsonb_build_object(
    'commande', (SELECT row_to_json(c) FROM public.commandes_fournisseurs c WHERE c.id = v_commande_id),
    'lignes', (
      SELECT jsonb_agg(row_to_json(l))
      FROM public.lignes_commande_fournisseur l
      WHERE l.commande_id = v_commande_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
