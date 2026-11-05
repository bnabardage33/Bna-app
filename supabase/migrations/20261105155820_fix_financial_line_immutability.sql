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
