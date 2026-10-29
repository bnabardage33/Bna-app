-- =============================================================================
-- BNA-APP — MIGRATION 004 : CALEPINAGES TERRASSE & BESOINS MATÉRIAUX
-- =============================================================================

-- 1. Table générique CALEPINAGES (compatible façade, terrasse, clôture)
CREATE TABLE IF NOT EXISTS public.calepinages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE RESTRICT,
  metier text NOT NULL CHECK (metier IN ('facade', 'terrasse', 'cloture')),
  version integer NOT NULL DEFAULT 1,
  statut text NOT NULL DEFAULT 'valide' CHECK (statut IN ('brouillon', 'valide', 'archive')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chantier_id, version)
);

CREATE INDEX IF NOT EXISTS idx_calepinages_entreprise ON public.calepinages(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_calepinages_chantier ON public.calepinages(chantier_id);

-- 2. Table spécialisée CALEPINAGES_TERRASSE (Paramètres & Résultats déterministes)
CREATE TABLE IF NOT EXISTS public.calepinages_terrasse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calepinage_id uuid NOT NULL REFERENCES public.calepinages(id) ON DELETE CASCADE,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  
  -- Paramètres techniques
  longueur_m numeric NOT NULL CHECK (longueur_m > 0),
  largeur_m numeric NOT NULL CHECK (largeur_m > 0),
  orientation_lames text NOT NULL DEFAULT 'longueur',
  largeur_lame_mm numeric NOT NULL CHECK (largeur_lame_mm > 0),
  longueur_lame_m numeric NOT NULL CHECK (longueur_lame_m > 0),
  espace_inter_lames_mm numeric NOT NULL DEFAULT 5.0,
  entraxe_lambourdes_cm numeric NOT NULL DEFAULT 40.0,
  entraxe_plots_cm numeric NOT NULL DEFAULT 50.0,
  type_fixation text NOT NULL DEFAULT 'vis' CHECK (type_fixation IN ('vis', 'clips')),
  marge_chutes_pct numeric NOT NULL DEFAULT 10.0,

  -- Résultats calculés
  surface_m2 numeric NOT NULL,
  ml_lames numeric NOT NULL,
  nb_lames integer NOT NULL,
  ml_lambourdes numeric NOT NULL,
  nb_lambourdes integer NOT NULL,
  nb_plots integer NOT NULL,
  nb_fixations integer NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calepinages_terrasse_calepinage ON public.calepinages_terrasse(calepinage_id);
CREATE INDEX IF NOT EXISTS idx_calepinages_terrasse_entreprise ON public.calepinages_terrasse(entreprise_id);

-- 3. Table BESOINS_MATÉRIAUX (Produits suite validation calepinage)
CREATE TABLE IF NOT EXISTS public.besoins_materiaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE RESTRICT,
  calepinage_id uuid REFERENCES public.calepinages(id) ON DELETE SET NULL,
  categorie text NOT NULL, -- lames, lambourdes, plots, fixations
  designation text NOT NULL,
  unite text NOT NULL, -- lames, lambourdes 3m, plots, vis
  quantite numeric NOT NULL CHECK (quantite >= 0),
  origine text NOT NULL DEFAULT 'calepinage' CHECK (origine IN ('calepinage', 'manuel', 'import')),
  statut text NOT NULL DEFAULT 'a_commander' CHECK (statut IN ('a_commander', 'commande', 'recu', 'annule')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_besoins_entreprise ON public.besoins_materiaux(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_besoins_chantier ON public.besoins_materiaux(chantier_id);
CREATE INDEX IF NOT EXISTS idx_besoins_calepinage ON public.besoins_materiaux(calepinage_id);

-- 4. RLS SUR CALEPINAGES
ALTER TABLE public.calepinages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calepinages_select ON public.calepinages;
CREATE POLICY calepinages_select ON public.calepinages
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_insert ON public.calepinages;
CREATE POLICY calepinages_insert ON public.calepinages
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_update ON public.calepinages;
CREATE POLICY calepinages_update ON public.calepinages
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_delete ON public.calepinages;
CREATE POLICY calepinages_delete ON public.calepinages
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());

-- 5. RLS SUR CALEPINAGES_TERRASSE
ALTER TABLE public.calepinages_terrasse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calepinages_terrasse_select ON public.calepinages_terrasse;
CREATE POLICY calepinages_terrasse_select ON public.calepinages_terrasse
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_terrasse_insert ON public.calepinages_terrasse;
CREATE POLICY calepinages_terrasse_insert ON public.calepinages_terrasse
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_terrasse_update ON public.calepinages_terrasse;
CREATE POLICY calepinages_terrasse_update ON public.calepinages_terrasse
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS calepinages_terrasse_delete ON public.calepinages_terrasse;
CREATE POLICY calepinages_terrasse_delete ON public.calepinages_terrasse
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());

-- 6. RLS SUR BESOINS_MATÉRIAUX
ALTER TABLE public.besoins_materiaux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS besoins_materiaux_select ON public.besoins_materiaux;
CREATE POLICY besoins_materiaux_select ON public.besoins_materiaux
  FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS besoins_materiaux_insert ON public.besoins_materiaux;
CREATE POLICY besoins_materiaux_insert ON public.besoins_materiaux
  FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS besoins_materiaux_update ON public.besoins_materiaux;
CREATE POLICY besoins_materiaux_update ON public.besoins_materiaux
  FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id())
  WITH CHECK (entreprise_id = public.get_auth_entreprise_id());

DROP POLICY IF EXISTS besoins_materiaux_delete ON public.besoins_materiaux;
CREATE POLICY besoins_materiaux_delete ON public.besoins_materiaux
  FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id());
