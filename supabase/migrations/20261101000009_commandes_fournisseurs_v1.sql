-- =============================================================================
-- BNA-APP — MIGRATION 009 : MODULE COMMANDES FOURNISSEURS V1
-- =============================================================================

-- 1. Table des FOURNISSEURS (Répertoire d'approvisionnement multi-tenant)
CREATE TABLE IF NOT EXISTS public.fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  nom text NOT NULL CHECK (char_length(trim(nom)) > 0),
  telephone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entreprise_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_fournisseurs_entreprise ON public.fournisseurs(entreprise_id);

-- 2. Table des COMPTEURS DE NUMÉROTATION ATOMIQUE (Anti-collision stricte)
CREATE TABLE IF NOT EXISTS public.compteurs_numerotation (
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  type_document text NOT NULL, -- 'commande_fournisseur'
  annee integer NOT NULL,
  dernier_numero integer NOT NULL DEFAULT 0,
  PRIMARY KEY (entreprise_id, type_document, annee)
);

-- 3. Table des COMMANDES FOURNISSEURS (En-tête, snapshot & traçabilité)
CREATE TABLE IF NOT EXISTS public.commandes_fournisseurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE RESTRICT,
  fournisseur_id uuid NOT NULL REFERENCES public.fournisseurs(id) ON DELETE RESTRICT,
  version_source_id uuid REFERENCES public.calepinages(id) ON DELETE SET NULL,
  version_source_numero integer, -- Numéro mémorisé : ex. 3 pour 'V3'
  numero_commande text NOT NULL, -- Format strict : CMD-YYYY-XXXX
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'envoyee', 'commandee', 'annulee')),
  date_commande timestamptz NOT NULL DEFAULT now(),
  commentaire text,
  reference_fournisseur text, -- Nullable, réservé évolutions futures (devis/n° négoce)
  piece_jointe_url text, -- Nullable, réservé évolutions futures (PDF bon de commande)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entreprise_id, numero_commande)
);

CREATE INDEX IF NOT EXISTS idx_commandes_fournisseurs_entreprise ON public.commandes_fournisseurs(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_commandes_fournisseurs_chantier ON public.commandes_fournisseurs(chantier_id);
CREATE INDEX IF NOT EXISTS idx_commandes_fournisseurs_fournisseur ON public.commandes_fournisseurs(fournisseur_id);

-- 4. Table des LIGNES DE COMMANDE FOURNISSEUR (Articles du snapshot)
CREATE TABLE IF NOT EXISTS public.lignes_commande_fournisseur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid NOT NULL REFERENCES public.commandes_fournisseurs(id) ON DELETE CASCADE,
  besoin_source_id uuid REFERENCES public.besoins_materiaux(id) ON DELETE SET NULL, -- Traçabilité V1 + préparation commandes partielles
  designation text NOT NULL CHECK (char_length(trim(designation)) > 0),
  categorie text NOT NULL,
  unite text NOT NULL,
  quantite numeric NOT NULL CHECK (quantite >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lignes_commande_commande ON public.lignes_commande_fournisseur(commande_id);
CREATE INDEX IF NOT EXISTS idx_lignes_commande_besoin ON public.lignes_commande_fournisseur(besoin_source_id);

-- -----------------------------------------------------------------------------
-- 5. SÉCURITÉ ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- -----------------------------------------------------------------------------

-- RLS FOURNISSEURS
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fournisseurs_select ON public.fournisseurs;
CREATE POLICY fournisseurs_select ON public.fournisseurs
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS fournisseurs_insert ON public.fournisseurs;
CREATE POLICY fournisseurs_insert ON public.fournisseurs
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS fournisseurs_update ON public.fournisseurs;
CREATE POLICY fournisseurs_update ON public.fournisseurs
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS fournisseurs_delete ON public.fournisseurs;
CREATE POLICY fournisseurs_delete ON public.fournisseurs
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());

-- RLS COMPTEURS DE NUMÉROTATION
ALTER TABLE public.compteurs_numerotation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compteurs_select ON public.compteurs_numerotation;
CREATE POLICY compteurs_select ON public.compteurs_numerotation
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS compteurs_insert ON public.compteurs_numerotation;
CREATE POLICY compteurs_insert ON public.compteurs_numerotation
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS compteurs_update ON public.compteurs_numerotation;
CREATE POLICY compteurs_update ON public.compteurs_numerotation
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

-- RLS COMMANDES FOURNISSEURS
ALTER TABLE public.commandes_fournisseurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commandes_fournisseurs_select ON public.commandes_fournisseurs;
CREATE POLICY commandes_fournisseurs_select ON public.commandes_fournisseurs
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS commandes_fournisseurs_insert ON public.commandes_fournisseurs;
CREATE POLICY commandes_fournisseurs_insert ON public.commandes_fournisseurs
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS commandes_fournisseurs_update ON public.commandes_fournisseurs;
CREATE POLICY commandes_fournisseurs_update ON public.commandes_fournisseurs
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS commandes_fournisseurs_delete ON public.commandes_fournisseurs;
CREATE POLICY commandes_fournisseurs_delete ON public.commandes_fournisseurs
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());

-- RLS LIGNES DE COMMANDE FOURNISSEUR
ALTER TABLE public.lignes_commande_fournisseur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lignes_commande_select ON public.lignes_commande_fournisseur;
CREATE POLICY lignes_commande_select ON public.lignes_commande_fournisseur
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commandes_fournisseurs c
      WHERE c.id = lignes_commande_fournisseur.commande_id
        AND c.entreprise_id = public.get_auth_entreprise_id()
    )
  );

DROP POLICY IF EXISTS lignes_commande_insert ON public.lignes_commande_fournisseur;
CREATE POLICY lignes_commande_insert ON public.lignes_commande_fournisseur
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commandes_fournisseurs c
      WHERE c.id = lignes_commande_fournisseur.commande_id
        AND c.entreprise_id = public.get_auth_entreprise_id()
    )
  );

DROP POLICY IF EXISTS lignes_commande_update ON public.lignes_commande_fournisseur;
CREATE POLICY lignes_commande_update ON public.lignes_commande_fournisseur
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.commandes_fournisseurs c
      WHERE c.id = lignes_commande_fournisseur.commande_id
        AND c.entreprise_id = public.get_auth_entreprise_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.commandes_fournisseurs c
      WHERE c.id = lignes_commande_fournisseur.commande_id
        AND c.entreprise_id = public.get_auth_entreprise_id()
    )
  );

DROP POLICY IF EXISTS lignes_commande_delete ON public.lignes_commande_fournisseur;
CREATE POLICY lignes_commande_delete ON public.lignes_commande_fournisseur
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.commandes_fournisseurs c
      WHERE c.id = lignes_commande_fournisseur.commande_id
        AND c.entreprise_id = public.get_auth_entreprise_id()
    )
  );

-- -----------------------------------------------------------------------------
-- 6. RPC TRANSACTIONNELLE ATOMIQUE : CRÉATION COMMANDE FOURNISSEUR
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creer_commande_fournisseur(
  p_chantier_id uuid,
  p_fournisseur_id uuid,
  p_version_source_id uuid,
  p_lignes jsonb,
  p_commentaire text DEFAULT NULL,
  p_reference_fournisseur text DEFAULT NULL
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
    reference_fournisseur
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
    p_reference_fournisseur
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
