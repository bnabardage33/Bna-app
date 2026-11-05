-- Socle financier Phase 1 : devis, factures et avoirs.
-- Les montants sont stockés en NUMERIC et calculés ligne par ligne.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.chantiers ch
    WHERE ch.client_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.clients c
         WHERE c.id = ch.client_id AND c.entreprise_id = ch.entreprise_id
       )
  ) THEN
    RAISE EXCEPTION 'Intégrité chantiers invalide: client absent, orphelin ou entreprise incohérente';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_chantiers_id_entreprise_client') THEN
    ALTER TABLE public.chantiers
      ADD CONSTRAINT uq_chantiers_id_entreprise_client UNIQUE (id, entreprise_id, client_id);
  END IF;
END;
$$;

CREATE TABLE public.devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  chantier_id uuid,
  numero text,
  statut text NOT NULL DEFAULT 'BROUILLON'
    CHECK (statut IN ('BROUILLON','ENVOYE','SIGNE','REFUSE','ANNULE')),
  date_creation date NOT NULL DEFAULT CURRENT_DATE,
  date_emission date,
  date_validite date NOT NULL,
  objet text NOT NULL CHECK (btrim(objet) <> ''),
  metier text NOT NULL CHECK (metier IN ('facade','terrasse','cloture')),
  acompte_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (acompte_pct BETWEEN 0 AND 100),
  retenue_garantie_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (retenue_garantie_pct BETWEEN 0 AND 5),
  total_ht numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_ht >= 0 AND total_ht < 10000000000000000),
  total_tva numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_tva >= 0 AND total_tva < 10000000000000000),
  total_ttc numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_ttc = total_ht + total_tva),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_devis_id_entreprise UNIQUE (id, entreprise_id),
  CONSTRAINT uq_devis_id_entreprise_client UNIQUE (id, entreprise_id, client_id),
  CONSTRAINT uq_devis_entreprise_numero UNIQUE (entreprise_id, numero),
  CONSTRAINT fk_devis_client FOREIGN KEY (client_id, entreprise_id)
    REFERENCES public.clients(id, entreprise_id) ON DELETE RESTRICT,
  CONSTRAINT fk_devis_chantier FOREIGN KEY (chantier_id, entreprise_id, client_id)
    REFERENCES public.chantiers(id, entreprise_id, client_id) ON DELETE RESTRICT,
  CHECK ((statut IN ('BROUILLON','ANNULE') AND numero IS NULL) OR (statut NOT IN ('BROUILLON','ANNULE') AND numero IS NOT NULL)),
  CHECK (statut IN ('BROUILLON','ANNULE') OR date_emission IS NOT NULL)
);

CREATE TABLE public.devis_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  designation text NOT NULL CHECK (btrim(designation) <> ''),
  description text,
  quantite numeric(18,6) NOT NULL CHECK (quantite >= 0 AND quantite < 1000000000000),
  unite text NOT NULL CHECK (btrim(unite) <> ''),
  prix_unitaire_ht numeric(18,6) NOT NULL CHECK (prix_unitaire_ht >= 0 AND prix_unitaire_ht < 1000000000000),
  prix_revient_ht numeric(18,6) NOT NULL DEFAULT 0 CHECK (prix_revient_ht >= 0 AND prix_revient_ht < 1000000000000),
  taux_tva numeric(5,2) NOT NULL CHECK (taux_tva IN (0,5.5,10,20)),
  type_cout text NOT NULL CHECK (type_cout IN ('matiere','main_oeuvre')),
  montant_ht numeric(18,2) GENERATED ALWAYS AS (round((quantite * prix_unitaire_ht)::numeric, 2)) STORED,
  montant_tva numeric(18,2) GENERATED ALWAYS AS (round((round((quantite * prix_unitaire_ht)::numeric, 2) * taux_tva / 100)::numeric, 2)) STORED,
  montant_ttc numeric(18,2) GENERATED ALWAYS AS (
    round((quantite * prix_unitaire_ht)::numeric, 2)
    + round((round((quantite * prix_unitaire_ht)::numeric, 2) * taux_tva / 100)::numeric, 2)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_devis_lignes_id_entreprise UNIQUE (id, entreprise_id),
  CONSTRAINT fk_devis_lignes_parent FOREIGN KEY (devis_id, entreprise_id)
    REFERENCES public.devis(id, entreprise_id) ON DELETE CASCADE
);

CREATE TABLE public.factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  devis_id uuid,
  chantier_id uuid,
  numero text,
  statut text NOT NULL DEFAULT 'BROUILLON'
    CHECK (statut IN ('BROUILLON','EMISE','PARTIELLEMENT_PAYEE','PAYEE','ANNULEE')),
  type text NOT NULL CHECK (type IN ('ACOMPTE','SITUATION','SOLDE','DIRECTE')),
  date_emission date,
  date_echeance date,
  contract_ref text,
  objet text NOT NULL CHECK (btrim(objet) <> ''),
  avancement_pct numeric(5,2) CHECK (avancement_pct BETWEEN 0 AND 100),
  retenue_garantie_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (retenue_garantie_pct BETWEEN 0 AND 5),
  montant_retenue_ttc numeric(18,2) NOT NULL DEFAULT 0 CHECK (montant_retenue_ttc >= 0 AND montant_retenue_ttc < 10000000000000000),
  total_ht numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_ht >= 0 AND total_ht < 10000000000000000),
  total_tva numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_tva >= 0 AND total_tva < 10000000000000000),
  total_ttc numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_ttc = total_ht + total_tva),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_factures_id_entreprise UNIQUE (id, entreprise_id),
  CONSTRAINT uq_factures_id_entreprise_client UNIQUE (id, entreprise_id, client_id),
  CONSTRAINT uq_factures_entreprise_numero UNIQUE (entreprise_id, numero),
  CONSTRAINT fk_factures_client FOREIGN KEY (client_id, entreprise_id)
    REFERENCES public.clients(id, entreprise_id) ON DELETE RESTRICT,
  CONSTRAINT fk_factures_devis FOREIGN KEY (devis_id, entreprise_id, client_id)
    REFERENCES public.devis(id, entreprise_id, client_id) ON DELETE RESTRICT,
  CONSTRAINT fk_factures_chantier FOREIGN KEY (chantier_id, entreprise_id, client_id)
    REFERENCES public.chantiers(id, entreprise_id, client_id) ON DELETE RESTRICT,
  CHECK ((statut IN ('BROUILLON','ANNULEE') AND numero IS NULL) OR (statut NOT IN ('BROUILLON','ANNULEE') AND numero IS NOT NULL)),
  CHECK (statut IN ('BROUILLON','ANNULEE') OR date_emission IS NOT NULL),
  CHECK (contract_ref IS NULL OR btrim(contract_ref) <> '')
);

CREATE TABLE public.facture_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  devis_ligne_id uuid,
  designation text NOT NULL CHECK (btrim(designation) <> ''),
  quantite numeric(18,6) NOT NULL CHECK (quantite >= 0 AND quantite < 1000000000000),
  unite text NOT NULL CHECK (btrim(unite) <> ''),
  prix_unitaire_ht numeric(18,6) NOT NULL CHECK (prix_unitaire_ht >= 0 AND prix_unitaire_ht < 1000000000000),
  taux_tva numeric(5,2) NOT NULL CHECK (taux_tva IN (0,5.5,10,20)),
  montant_ht numeric(18,2) GENERATED ALWAYS AS (round((quantite * prix_unitaire_ht)::numeric, 2)) STORED,
  montant_tva numeric(18,2) GENERATED ALWAYS AS (round((round((quantite * prix_unitaire_ht)::numeric, 2) * taux_tva / 100)::numeric, 2)) STORED,
  montant_ttc numeric(18,2) GENERATED ALWAYS AS (
    round((quantite * prix_unitaire_ht)::numeric, 2)
    + round((round((quantite * prix_unitaire_ht)::numeric, 2) * taux_tva / 100)::numeric, 2)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_facture_lignes_parent FOREIGN KEY (facture_id, entreprise_id)
    REFERENCES public.factures(id, entreprise_id) ON DELETE CASCADE,
  CONSTRAINT fk_facture_lignes_devis_ligne FOREIGN KEY (devis_ligne_id, entreprise_id)
    REFERENCES public.devis_lignes(id, entreprise_id) ON DELETE RESTRICT
);

CREATE TABLE public.avoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL,
  scope text NOT NULL CHECK (scope IN ('INVOICE','GLOBAL')),
  origin_invoice_id uuid,
  period_start date,
  period_end date,
  global_basis text CHECK (global_basis IN ('CONTRACT','INVOICES')),
  contract_ref text,
  numero text,
  statut text NOT NULL DEFAULT 'BROUILLON' CHECK (statut IN ('BROUILLON','EMIS','ANNULE')),
  date_emission date,
  objet text NOT NULL CHECK (btrim(objet) <> ''),
  total_ht numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_ht >= 0 AND total_ht < 10000000000000000),
  total_tva numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_tva >= 0 AND total_tva < 10000000000000000),
  total_ttc numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_ttc = total_ht + total_tva),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_avoirs_id_entreprise UNIQUE (id, entreprise_id),
  CONSTRAINT uq_avoirs_id_entreprise_client UNIQUE (id, entreprise_id, client_id),
  CONSTRAINT uq_avoirs_entreprise_numero UNIQUE (entreprise_id, numero),
  CONSTRAINT fk_avoirs_client FOREIGN KEY (client_id, entreprise_id)
    REFERENCES public.clients(id, entreprise_id) ON DELETE RESTRICT,
  CONSTRAINT fk_avoirs_origin_invoice FOREIGN KEY (origin_invoice_id, entreprise_id, client_id)
    REFERENCES public.factures(id, entreprise_id, client_id) ON DELETE RESTRICT,
  CHECK (
    (scope = 'INVOICE' AND origin_invoice_id IS NOT NULL AND period_start IS NULL
      AND period_end IS NULL AND global_basis IS NULL AND contract_ref IS NULL)
    OR
    (scope = 'GLOBAL' AND origin_invoice_id IS NULL AND period_start IS NOT NULL
      AND period_end IS NOT NULL AND period_start <= period_end AND global_basis IS NOT NULL)
  ),
  CHECK (global_basis <> 'CONTRACT' OR (contract_ref IS NOT NULL AND btrim(contract_ref) <> '')),
  CHECK (global_basis <> 'INVOICES' OR contract_ref IS NULL),
  CHECK ((statut IN ('BROUILLON','ANNULE') AND numero IS NULL) OR (statut NOT IN ('BROUILLON','ANNULE') AND numero IS NOT NULL)),
  CHECK (statut IN ('BROUILLON','ANNULE') OR date_emission IS NOT NULL)
);

CREATE TABLE public.avoir_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id uuid NOT NULL,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE RESTRICT,
  designation text NOT NULL CHECK (btrim(designation) <> ''),
  quantite numeric(18,6) NOT NULL CHECK (quantite >= 0 AND quantite < 1000000000000),
  unite text NOT NULL CHECK (btrim(unite) <> ''),
  prix_unitaire_ht numeric(18,6) NOT NULL CHECK (prix_unitaire_ht >= 0 AND prix_unitaire_ht < 1000000000000),
  taux_tva numeric(5,2) NOT NULL CHECK (taux_tva IN (0,5.5,10,20)),
  montant_ht numeric(18,2) GENERATED ALWAYS AS (round((quantite * prix_unitaire_ht)::numeric, 2)) STORED,
  montant_tva numeric(18,2) GENERATED ALWAYS AS (round((round((quantite * prix_unitaire_ht)::numeric, 2) * taux_tva / 100)::numeric, 2)) STORED,
  montant_ttc numeric(18,2) GENERATED ALWAYS AS (
    round((quantite * prix_unitaire_ht)::numeric, 2)
    + round((round((quantite * prix_unitaire_ht)::numeric, 2) * taux_tva / 100)::numeric, 2)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_avoir_lignes_parent FOREIGN KEY (avoir_id, entreprise_id)
    REFERENCES public.avoirs(id, entreprise_id) ON DELETE CASCADE
);

CREATE TABLE public.credit_note_invoices (
  credit_note_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  entreprise_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (credit_note_id, invoice_id),
  CONSTRAINT uq_credit_note_invoice_reserved UNIQUE (invoice_id),
  CONSTRAINT fk_credit_note_invoice_note FOREIGN KEY (credit_note_id, entreprise_id, client_id)
    REFERENCES public.avoirs(id, entreprise_id, client_id) ON DELETE RESTRICT,
  CONSTRAINT fk_credit_note_invoice_invoice FOREIGN KEY (invoice_id, entreprise_id, client_id)
    REFERENCES public.factures(id, entreprise_id, client_id) ON DELETE RESTRICT
);

CREATE INDEX idx_devis_entreprise_date ON public.devis (entreprise_id, date_creation DESC);
CREATE INDEX idx_devis_client ON public.devis (client_id, entreprise_id);
CREATE INDEX idx_devis_lignes_parent ON public.devis_lignes (devis_id, entreprise_id);
CREATE INDEX idx_factures_client_date ON public.factures (client_id, date_emission DESC);
CREATE INDEX idx_factures_devis ON public.factures (devis_id, entreprise_id) WHERE devis_id IS NOT NULL;
CREATE INDEX idx_factures_contrat_periode ON public.factures (entreprise_id, client_id, contract_ref, date_emission);
CREATE INDEX idx_facture_lignes_parent ON public.facture_lignes (facture_id, entreprise_id);
CREATE INDEX idx_avoirs_origin ON public.avoirs (origin_invoice_id, entreprise_id) WHERE origin_invoice_id IS NOT NULL;
CREATE INDEX idx_avoirs_global_periode ON public.avoirs (entreprise_id, client_id, contract_ref, period_start, period_end)
  WHERE scope = 'GLOBAL' AND global_basis = 'CONTRACT' AND statut = 'EMIS';
CREATE INDEX idx_avoir_lignes_parent ON public.avoir_lignes (avoir_id, entreprise_id);
CREATE INDEX idx_credit_note_invoice_invoice ON public.credit_note_invoices (invoice_id, entreprise_id, client_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['devis','devis_lignes','factures','facture_lignes','avoirs','avoir_lignes','credit_note_invoices'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (entreprise_id = public.get_auth_entreprise_id())', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (entreprise_id = public.get_auth_entreprise_id())', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (entreprise_id = public.get_auth_entreprise_id()) WITH CHECK (entreprise_id = public.get_auth_entreprise_id())', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (entreprise_id = public.get_auth_entreprise_id())', t, t);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_document_financier_emis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_status text;
BEGIN
  IF TG_TABLE_NAME IN ('factures','avoirs') THEN
    IF TG_OP = 'DELETE' AND OLD.statut <> 'BROUILLON' THEN
      RAISE EXCEPTION 'DOCUMENT_EMIS_IMMUABLE';
    ELSIF TG_OP = 'UPDATE' AND OLD.statut <> 'BROUILLON' THEN
      IF (to_jsonb(NEW) - ARRAY['statut','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['statut','updated_at']) THEN
        RAISE EXCEPTION 'DOCUMENT_EMIS_IMMUABLE';
      END IF;
      IF TG_TABLE_NAME = 'factures' AND NOT (
        (OLD.statut = 'EMISE' AND NEW.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')) OR
        (OLD.statut = 'PARTIELLEMENT_PAYEE' AND NEW.statut IN ('PARTIELLEMENT_PAYEE','PAYEE')) OR
        (OLD.statut = 'PAYEE' AND NEW.statut = 'PAYEE')
      ) THEN RAISE EXCEPTION 'TRANSITION_STATUT_FACTURE_INTERDITE'; END IF;
      IF TG_TABLE_NAME = 'avoirs' AND NEW.statut <> OLD.statut THEN RAISE EXCEPTION 'AVOIR_EMIS_IRREVOCABLE'; END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'devis_lignes' THEN
    IF TG_OP IN ('UPDATE','DELETE') THEN
      SELECT statut INTO v_status FROM public.devis
      WHERE id = OLD.devis_id AND entreprise_id = OLD.entreprise_id;
      IF NOT FOUND THEN
        IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
        RAISE EXCEPTION 'DOCUMENT_PARENT_INVALIDE';
      END IF;
      IF v_status <> 'BROUILLON' THEN RAISE EXCEPTION 'LIGNES_DOCUMENT_EMIS_IMMUABLES'; END IF;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') THEN
      SELECT statut INTO v_status FROM public.devis
      WHERE id = NEW.devis_id AND entreprise_id = NEW.entreprise_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_PARENT_INVALIDE'; END IF;
      IF v_status <> 'BROUILLON' THEN RAISE EXCEPTION 'LIGNES_DOCUMENT_EMIS_IMMUABLES'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'facture_lignes' THEN
    IF TG_OP IN ('UPDATE','DELETE') THEN
      SELECT statut INTO v_status FROM public.factures
      WHERE id = OLD.facture_id AND entreprise_id = OLD.entreprise_id;
      IF NOT FOUND THEN
        IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
        RAISE EXCEPTION 'DOCUMENT_PARENT_INVALIDE';
      END IF;
      IF v_status <> 'BROUILLON' THEN RAISE EXCEPTION 'LIGNES_DOCUMENT_EMIS_IMMUABLES'; END IF;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') THEN
      SELECT statut INTO v_status FROM public.factures
      WHERE id = NEW.facture_id AND entreprise_id = NEW.entreprise_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_PARENT_INVALIDE'; END IF;
      IF v_status <> 'BROUILLON' THEN RAISE EXCEPTION 'LIGNES_DOCUMENT_EMIS_IMMUABLES'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'avoir_lignes' THEN
    IF TG_OP IN ('UPDATE','DELETE') THEN
      SELECT statut INTO v_status FROM public.avoirs
      WHERE id = OLD.avoir_id AND entreprise_id = OLD.entreprise_id;
      IF NOT FOUND THEN
        IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
        RAISE EXCEPTION 'DOCUMENT_PARENT_INVALIDE';
      END IF;
      IF v_status <> 'BROUILLON' THEN RAISE EXCEPTION 'LIGNES_DOCUMENT_EMIS_IMMUABLES'; END IF;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') THEN
      SELECT statut INTO v_status FROM public.avoirs
      WHERE id = NEW.avoir_id AND entreprise_id = NEW.entreprise_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_PARENT_INVALIDE'; END IF;
      IF v_status <> 'BROUILLON' THEN RAISE EXCEPTION 'LIGNES_DOCUMENT_EMIS_IMMUABLES'; END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'TRIGGER_TABLE_FINANCIERE_INVALIDE';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_devis_lignes_immutabilite BEFORE INSERT OR UPDATE OR DELETE ON public.devis_lignes
FOR EACH ROW EXECUTE FUNCTION public.proteger_document_financier_emis('devis');
CREATE TRIGGER trg_factures_immutabilite BEFORE UPDATE OR DELETE ON public.factures
FOR EACH ROW EXECUTE FUNCTION public.proteger_document_financier_emis('factures');
CREATE TRIGGER trg_facture_lignes_immutabilite BEFORE INSERT OR UPDATE OR DELETE ON public.facture_lignes
FOR EACH ROW EXECUTE FUNCTION public.proteger_document_financier_emis('facture_lignes');
CREATE TRIGGER trg_avoirs_immutabilite BEFORE UPDATE OR DELETE ON public.avoirs
FOR EACH ROW EXECUTE FUNCTION public.proteger_document_financier_emis('avoirs');
CREATE TRIGGER trg_avoir_lignes_immutabilite BEFORE INSERT OR UPDATE OR DELETE ON public.avoir_lignes
FOR EACH ROW EXECUTE FUNCTION public.proteger_document_financier_emis('avoir_lignes');

CREATE OR REPLACE FUNCTION public.allouer_numero_financier(p_type text, p_date date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE v_entreprise uuid; v_year integer; v_seq integer; v_prefix text;
BEGIN
  v_entreprise := public.get_auth_entreprise_id();
  IF v_entreprise IS NULL THEN RAISE EXCEPTION 'ENTREPRISE_NON_AUTORISEE' USING ERRCODE = '42501'; END IF;
  v_year := EXTRACT(YEAR FROM p_date)::int;
  v_prefix := CASE p_type WHEN 'DEVIS' THEN 'DEVIS' WHEN 'FACTURE' THEN 'FACTURE' WHEN 'AVOIR' THEN 'AVOIR'
    ELSE NULL END;
  IF v_prefix IS NULL THEN RAISE EXCEPTION 'TYPE_DOCUMENT_INVALIDE'; END IF;
  INSERT INTO public.compteurs_numerotation (entreprise_id,type_document,annee,dernier_numero)
    VALUES (v_entreprise,p_type,v_year,1)
    ON CONFLICT (entreprise_id,type_document,annee)
    DO UPDATE SET dernier_numero = public.compteurs_numerotation.dernier_numero + 1
    RETURNING dernier_numero INTO v_seq;
  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text,6,'0');
END;
$$;

CREATE OR REPLACE FUNCTION public.creer_devis_financier(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE v_ent uuid; v_id uuid := gen_random_uuid(); v_client uuid; v_chantier uuid; v_line jsonb; v_ht numeric(18,2); v_tva numeric(18,2); v_ttc numeric(18,2); v_date date := CURRENT_DATE;
BEGIN
  v_ent := public.get_auth_entreprise_id();
  IF v_ent IS NULL THEN RAISE EXCEPTION 'ENTREPRISE_NON_AUTORISEE' USING ERRCODE='42501'; END IF;
  IF p_payload IS NULL THEN RAISE EXCEPTION 'PAYLOAD_SQL_NULL'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PAYLOAD_FORMAT_INVALIDE'; END IF;
  IF NOT (p_payload ? 'lignes') THEN RAISE EXCEPTION 'LIGNES_ABSENTES'; END IF;
  IF p_payload->'lignes' = 'null'::jsonb THEN RAISE EXCEPTION 'LIGNES_NULL'; END IF;
  IF jsonb_typeof(p_payload->'lignes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'LIGNES_FORMAT_INVALIDE'; END IF;
  IF jsonb_array_length(p_payload->'lignes') = 0 THEN RAISE EXCEPTION 'DEVIS_SANS_LIGNE'; END IF;
  v_client := (p_payload->>'client_id')::uuid;
  v_chantier := nullif(p_payload->>'chantier_id','')::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id=v_client AND entreprise_id=v_ent) THEN RAISE EXCEPTION 'CLIENT_INVALIDE'; END IF;
  INSERT INTO public.devis (id,entreprise_id,client_id,chantier_id,statut,date_creation,date_emission,date_validite,objet,metier,acompte_pct,retenue_garantie_pct,notes,total_ht,total_tva,total_ttc)
  VALUES (v_id,v_ent,v_client,v_chantier,'BROUILLON',v_date,NULL,(p_payload->>'date_validite')::date,p_payload->>'objet',p_payload->>'metier',coalesce((p_payload->>'acompte_pct')::numeric,0),coalesce((p_payload->>'retenue_garantie_pct')::numeric,0),p_payload->>'notes',0,0,0);
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lignes') LOOP
    INSERT INTO public.devis_lignes (devis_id,entreprise_id,designation,description,quantite,unite,prix_unitaire_ht,prix_revient_ht,taux_tva,type_cout)
    VALUES (v_id,v_ent,v_line->>'designation',v_line->>'description',(v_line->>'quantite')::numeric,v_line->>'unite',(v_line->>'prix_unitaire_ht')::numeric,coalesce((v_line->>'prix_revient_ht')::numeric,0),(v_line->>'taux_tva')::numeric,v_line->>'type_cout');
  END LOOP;
  SELECT coalesce(sum(montant_ht),0),coalesce(sum(montant_tva),0) INTO v_ht,v_tva FROM public.devis_lignes WHERE devis_id=v_id;
  v_ttc := v_ht+v_tva;
  UPDATE public.devis SET total_ht=v_ht,total_tva=v_tva,total_ttc=v_ttc,statut='ENVOYE',date_emission=v_date,
    numero=public.allouer_numero_financier('DEVIS',v_date),updated_at=now() WHERE id=v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.emettre_facture_financiere(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE v_ent uuid; v_id uuid := gen_random_uuid(); v_devis uuid; v_client uuid; v_chantier uuid; v_line jsonb; v_ht numeric(18,2); v_tva numeric(18,2); v_ttc numeric(18,2); v_date date := CURRENT_DATE;
BEGIN
  v_ent := public.get_auth_entreprise_id();
  IF v_ent IS NULL THEN RAISE EXCEPTION 'ENTREPRISE_NON_AUTORISEE' USING ERRCODE='42501'; END IF;
  IF p_payload IS NULL THEN RAISE EXCEPTION 'PAYLOAD_SQL_NULL'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PAYLOAD_FORMAT_INVALIDE'; END IF;
  IF NOT (p_payload ? 'lignes') THEN RAISE EXCEPTION 'LIGNES_ABSENTES'; END IF;
  IF p_payload->'lignes' = 'null'::jsonb THEN RAISE EXCEPTION 'LIGNES_NULL'; END IF;
  IF jsonb_typeof(p_payload->'lignes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'LIGNES_FORMAT_INVALIDE'; END IF;
  IF jsonb_array_length(p_payload->'lignes') = 0 THEN RAISE EXCEPTION 'FACTURE_SANS_LIGNE'; END IF;
  v_devis := nullif(p_payload->>'devis_id','')::uuid;
  v_client := (p_payload->>'client_id')::uuid;
  v_chantier := nullif(p_payload->>'chantier_id','')::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id=v_client AND entreprise_id=v_ent) THEN RAISE EXCEPTION 'CLIENT_INVALIDE'; END IF;
  IF v_devis IS NOT NULL THEN
    PERFORM 1 FROM public.devis
    WHERE id=v_devis AND entreprise_id=v_ent AND client_id=v_client AND statut='SIGNE'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DEVIS_NON_SIGNE_OU_INVALIDE'; END IF;
  END IF;
  IF v_devis IS NOT NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_payload->'lignes') j
    WHERE NOT EXISTS (
      SELECT 1 FROM public.devis_lignes dl
      WHERE dl.id=(j->>'devis_ligne_id')::uuid AND dl.devis_id=v_devis AND dl.entreprise_id=v_ent
        AND dl.prix_unitaire_ht=(j->>'prix_unitaire_ht')::numeric
        AND dl.taux_tva=(j->>'taux_tva')::numeric
    )
  ) THEN RAISE EXCEPTION 'LIGNE_FACTURE_HORS_DEVIS'; END IF;
  INSERT INTO public.factures (id,entreprise_id,client_id,devis_id,chantier_id,statut,type,date_emission,date_echeance,contract_ref,objet,avancement_pct,retenue_garantie_pct,total_ht,total_tva,total_ttc)
  VALUES (v_id,v_ent,v_client,v_devis,v_chantier,'BROUILLON',p_payload->>'type',NULL,(p_payload->>'date_echeance')::date,nullif(btrim(p_payload->>'contract_ref'),''),p_payload->>'objet',nullif(p_payload->>'avancement_pct','')::numeric,coalesce((p_payload->>'retenue_garantie_pct')::numeric,0),0,0,0);
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lignes') LOOP
    INSERT INTO public.facture_lignes (facture_id,entreprise_id,devis_ligne_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
    VALUES (v_id,v_ent,nullif(v_line->>'devis_ligne_id','')::uuid,v_line->>'designation',(v_line->>'quantite')::numeric,v_line->>'unite',(v_line->>'prix_unitaire_ht')::numeric,(v_line->>'taux_tva')::numeric);
  END LOOP;
  IF v_devis IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.devis_lignes dl
    WHERE dl.devis_id=v_devis AND dl.entreprise_id=v_ent
      AND dl.quantite < coalesce((SELECT sum(fl.quantite) FROM public.factures f JOIN public.facture_lignes fl ON fl.facture_id=f.id
        WHERE f.devis_id=v_devis AND f.entreprise_id=v_ent AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')
          AND fl.devis_ligne_id=dl.id),0)
        + coalesce((SELECT sum(fl.quantite) FROM public.facture_lignes fl WHERE fl.facture_id=v_id AND fl.devis_ligne_id=dl.id),0)
  ) THEN RAISE EXCEPTION 'AVANCEMENT_CUMULE_DEPASSE'; END IF;
  SELECT coalesce(sum(montant_ht),0),coalesce(sum(montant_tva),0) INTO v_ht,v_tva FROM public.facture_lignes WHERE facture_id=v_id;
  v_ttc := v_ht+v_tva;
  UPDATE public.factures SET total_ht=v_ht,total_tva=v_tva,total_ttc=v_ttc,
    montant_retenue_ttc=round((v_ttc * retenue_garantie_pct / 100)::numeric,2),
    numero=public.allouer_numero_financier('FACTURE',v_date),date_emission=v_date,statut='EMISE',updated_at=now() WHERE id=v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.emettre_avoir_financier(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
DECLARE v_ent uuid; v_id uuid := gen_random_uuid(); v_client uuid; v_origin uuid; v_scope text; v_basis text; v_line jsonb; v_ht numeric(18,2); v_tva numeric(18,2); v_ttc numeric(18,2); v_date date := CURRENT_DATE; v_ids uuid[];
BEGIN
  v_ent := public.get_auth_entreprise_id();
  IF v_ent IS NULL THEN RAISE EXCEPTION 'ENTREPRISE_NON_AUTORISEE' USING ERRCODE='42501'; END IF;
  IF p_payload IS NULL THEN RAISE EXCEPTION 'PAYLOAD_SQL_NULL'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PAYLOAD_FORMAT_INVALIDE'; END IF;
  IF NOT (p_payload ? 'lignes') THEN RAISE EXCEPTION 'LIGNES_ABSENTES'; END IF;
  IF p_payload->'lignes' = 'null'::jsonb THEN RAISE EXCEPTION 'LIGNES_NULL'; END IF;
  IF jsonb_typeof(p_payload->'lignes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'LIGNES_FORMAT_INVALIDE'; END IF;
  IF jsonb_array_length(p_payload->'lignes') = 0 THEN RAISE EXCEPTION 'AVOIR_SANS_LIGNE'; END IF;
  v_client := (p_payload->>'client_id')::uuid;
  v_scope := p_payload->>'scope'; v_basis := p_payload->>'global_basis';
  v_origin := nullif(p_payload->>'origin_invoice_id','')::uuid;
  IF v_scope='GLOBAL' AND (nullif(p_payload->>'period_start','') IS NULL OR nullif(p_payload->>'period_end','') IS NULL
     OR (p_payload->>'period_start')::date > (p_payload->>'period_end')::date) THEN
    RAISE EXCEPTION 'PERIODE_AVOIR_INVALIDE';
  END IF;
  IF v_scope='INVOICE' THEN
    PERFORM 1 FROM public.factures WHERE id=v_origin AND entreprise_id=v_ent AND client_id=v_client
      AND statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE') AND NOT EXISTS (SELECT 1 FROM public.credit_note_invoices x WHERE x.invoice_id=factures.id) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FACTURE_ORIGINE_INELIGIBLE'; END IF;
    IF EXISTS (SELECT 1 FROM public.credit_note_invoices x WHERE x.invoice_id=v_origin) THEN
      RAISE EXCEPTION 'FACTURE_DEJA_RESERVEE';
    END IF;
  ELSIF v_scope='GLOBAL' AND v_basis='CONTRACT' THEN
    SELECT array_agg(f.id ORDER BY f.id) INTO v_ids FROM public.factures f
    WHERE f.entreprise_id=v_ent AND f.client_id=v_client AND f.contract_ref=btrim(p_payload->>'contract_ref')
      AND f.date_emission BETWEEN (p_payload->>'period_start')::date AND (p_payload->>'period_end')::date
      AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')
      AND NOT EXISTS (SELECT 1 FROM public.credit_note_invoices x WHERE x.invoice_id=f.id);
    IF coalesce(cardinality(v_ids),0)=0 THEN RAISE EXCEPTION 'PERIMETRE_GLOBAL_VIDE'; END IF;
  ELSIF v_scope='GLOBAL' AND v_basis='INVOICES' THEN
    IF jsonb_typeof(p_payload->'invoice_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'FACTURES_SELECTION_INVALIDE'; END IF;
    SELECT array_agg(DISTINCT (value #>> '{}')::uuid ORDER BY (value #>> '{}')::uuid) INTO v_ids
      FROM jsonb_array_elements(p_payload->'invoice_ids');
    IF coalesce(cardinality(v_ids),0)=0 THEN RAISE EXCEPTION 'PERIMETRE_GLOBAL_VIDE'; END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_ids) i WHERE NOT EXISTS (
      SELECT 1 FROM public.factures f WHERE f.id=i AND f.entreprise_id=v_ent AND f.client_id=v_client
        AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')
        AND f.date_emission BETWEEN (p_payload->>'period_start')::date AND (p_payload->>'period_end')::date
        AND NOT EXISTS (SELECT 1 FROM public.credit_note_invoices x WHERE x.invoice_id=f.id))) THEN
      RAISE EXCEPTION 'FACTURE_PERIMETRE_INELIGIBLE';
    END IF;
  ELSE RAISE EXCEPTION 'SCOPE_AVOIR_INVALIDE'; END IF;

  IF v_scope='GLOBAL' THEN
    PERFORM 1 FROM public.factures f WHERE f.id=ANY(v_ids) ORDER BY f.id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.credit_note_invoices WHERE invoice_id=ANY(v_ids)) THEN RAISE EXCEPTION 'FACTURE_DEJA_RESERVEE'; END IF;
  END IF;
  INSERT INTO public.avoirs (id,entreprise_id,client_id,scope,origin_invoice_id,period_start,period_end,global_basis,contract_ref,statut,date_emission,objet,total_ht,total_tva,total_ttc)
  VALUES (v_id,v_ent,v_client,v_scope,v_origin,nullif(p_payload->>'period_start','')::date,nullif(p_payload->>'period_end','')::date,v_basis,nullif(btrim(p_payload->>'contract_ref'),''),'BROUILLON',NULL,p_payload->>'objet',0,0,0);
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload->'lignes') LOOP
    INSERT INTO public.avoir_lignes (avoir_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
    VALUES (v_id,v_ent,v_line->>'designation',(v_line->>'quantite')::numeric,v_line->>'unite',(v_line->>'prix_unitaire_ht')::numeric,(v_line->>'taux_tva')::numeric);
  END LOOP;
  SELECT coalesce(sum(montant_ht),0),coalesce(sum(montant_tva),0) INTO v_ht,v_tva FROM public.avoir_lignes WHERE avoir_id=v_id;
  v_ttc := v_ht+v_tva;
  IF v_scope='INVOICE' AND EXISTS (
    SELECT 1
    FROM (SELECT taux_tva,sum(montant_ht) ht,sum(montant_tva) tv,sum(montant_ttc) tt
          FROM public.avoir_lignes WHERE avoir_id=v_id GROUP BY taux_tva) a
    WHERE a.ht > (SELECT coalesce(sum(fl.montant_ht),0) FROM public.facture_lignes fl WHERE fl.facture_id=v_origin AND fl.taux_tva=a.taux_tva)
        - (SELECT coalesce(sum(al.montant_ht),0) FROM public.avoirs ax JOIN public.avoir_lignes al ON al.avoir_id=ax.id WHERE ax.origin_invoice_id=v_origin AND ax.statut='EMIS' AND al.taux_tva=a.taux_tva)
       OR a.tv > (SELECT coalesce(sum(fl.montant_tva),0) FROM public.facture_lignes fl WHERE fl.facture_id=v_origin AND fl.taux_tva=a.taux_tva)
        - (SELECT coalesce(sum(al.montant_tva),0) FROM public.avoirs ax JOIN public.avoir_lignes al ON al.avoir_id=ax.id WHERE ax.origin_invoice_id=v_origin AND ax.statut='EMIS' AND al.taux_tva=a.taux_tva)
       OR a.tt > (SELECT coalesce(sum(fl.montant_ttc),0) FROM public.facture_lignes fl WHERE fl.facture_id=v_origin AND fl.taux_tva=a.taux_tva)
        - (SELECT coalesce(sum(al.montant_ttc),0) FROM public.avoirs ax JOIN public.avoir_lignes al ON al.avoir_id=ax.id WHERE ax.origin_invoice_id=v_origin AND ax.statut='EMIS' AND al.taux_tva=a.taux_tva)
  ) THEN RAISE EXCEPTION 'PLAFOND_AVOIR_DEPASSE'; END IF;
  IF v_scope='GLOBAL' AND EXISTS (
    SELECT 1
    FROM (SELECT taux_tva,sum(montant_ht) ht,sum(montant_tva) tv,sum(montant_ttc) tt
          FROM public.avoir_lignes WHERE avoir_id=v_id GROUP BY taux_tva) a
    WHERE a.ht > (SELECT coalesce(sum(fl.montant_ht),0) FROM public.facture_lignes fl WHERE fl.facture_id=ANY(v_ids) AND fl.taux_tva=a.taux_tva)
        - (SELECT coalesce(sum(al.montant_ht),0) FROM public.avoirs ax JOIN public.avoir_lignes al ON al.avoir_id=ax.id WHERE ax.origin_invoice_id=ANY(v_ids) AND ax.statut='EMIS' AND al.taux_tva=a.taux_tva)
       OR a.tv > (SELECT coalesce(sum(fl.montant_tva),0) FROM public.facture_lignes fl WHERE fl.facture_id=ANY(v_ids) AND fl.taux_tva=a.taux_tva)
        - (SELECT coalesce(sum(al.montant_tva),0) FROM public.avoirs ax JOIN public.avoir_lignes al ON al.avoir_id=ax.id WHERE ax.origin_invoice_id=ANY(v_ids) AND ax.statut='EMIS' AND al.taux_tva=a.taux_tva)
       OR a.tt > (SELECT coalesce(sum(fl.montant_ttc),0) FROM public.facture_lignes fl WHERE fl.facture_id=ANY(v_ids) AND fl.taux_tva=a.taux_tva)
        - (SELECT coalesce(sum(al.montant_ttc),0) FROM public.avoirs ax JOIN public.avoir_lignes al ON al.avoir_id=ax.id WHERE ax.origin_invoice_id=ANY(v_ids) AND ax.statut='EMIS' AND al.taux_tva=a.taux_tva)
  ) THEN RAISE EXCEPTION 'PLAFOND_GLOBAL_DEPASSE'; END IF;
  IF v_scope='GLOBAL' THEN
    INSERT INTO public.credit_note_invoices (credit_note_id,invoice_id,entreprise_id,client_id)
      SELECT v_id,i,v_ent,v_client FROM unnest(v_ids) i ORDER BY i;
  END IF;
  UPDATE public.avoirs SET total_ht=v_ht,total_tva=v_tva,total_ttc=v_ttc,numero=public.allouer_numero_financier('AVOIR',v_date),date_emission=v_date,statut='EMIS',updated_at=now() WHERE id=v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.marquer_devis_signe(p_devis_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
BEGIN
  UPDATE public.devis SET statut='SIGNE',updated_at=now()
  WHERE id=p_devis_id AND entreprise_id=public.get_auth_entreprise_id() AND statut='ENVOYE';
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSITION_DEVIS_INVALIDE'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.supprimer_devis_brouillon(p_devis_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth AS $$
BEGIN
  DELETE FROM public.devis WHERE id=p_devis_id AND entreprise_id=public.get_auth_entreprise_id() AND statut='BROUILLON';
  IF NOT FOUND THEN RAISE EXCEPTION 'SEUL_UN_DEVIS_BROUILLON_PEUT_ETRE_SUPPRIME'; END IF;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.devis, public.devis_lignes, public.factures, public.facture_lignes,
  public.avoirs, public.avoir_lignes, public.credit_note_invoices FROM anon, authenticated;
GRANT SELECT ON public.devis, public.devis_lignes, public.factures, public.facture_lignes,
  public.avoirs, public.avoir_lignes, public.credit_note_invoices TO authenticated;

REVOKE ALL ON FUNCTION public.allouer_numero_financier(text,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.creer_devis_financier(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emettre_facture_financiere(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emettre_avoir_financier(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marquer_devis_signe(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.supprimer_devis_brouillon(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creer_devis_financier(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emettre_facture_financiere(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.emettre_avoir_financier(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marquer_devis_signe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_devis_brouillon(uuid) TO authenticated;
