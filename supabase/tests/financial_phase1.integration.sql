\set ON_ERROR_STOP on
\echo 'Finance Phase 1: migration trigger fix, fixtures, RPCs, security, reservations'
BEGIN;

CREATE FUNCTION pg_temp.assert_true(p_value boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_value IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ASSERTION FAILED: %', p_message;
  END IF;
END;
$$;

CREATE FUNCTION pg_temp.expect_error(p_sql text, p_fragment text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF position(p_fragment IN v_message) > 0 THEN RETURN; END IF;
    RAISE EXCEPTION 'ASSERTION FAILED: expected error containing %, received %', p_fragment, v_message;
  END;
  RAISE EXCEPTION 'ASSERTION FAILED: expected error containing %, statement succeeded', p_fragment;
END;
$$;

-- Explicit deterministic identities: no production data and no ordering dependency.
INSERT INTO public.entreprises (id, nom) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Entreprise test Alpha'),
  ('20000000-0000-4000-8000-000000000002', 'Entreprise test Beta');
INSERT INTO auth.users (id) VALUES
  ('10000000-0000-4000-8000-000000000011'),
  ('20000000-0000-4000-8000-000000000022');
INSERT INTO public.profils (id, entreprise_id, prenom, nom, role) VALUES
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'Alice', 'Test', 'dirigeant'),
  ('20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000002', 'Benoit', 'Test', 'dirigeant');
INSERT INTO public.clients (id, entreprise_id, type_client, nom) VALUES
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'professionnel', 'Client fictif Alpha'),
  ('20000000-0000-4000-8000-000000000202', '20000000-0000-4000-8000-000000000002', 'professionnel', 'Client fictif Beta');
INSERT INTO public.chantiers (id, entreprise_id, client_id, nom, metier) VALUES
  ('10000000-0000-4000-8000-000000000111', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', 'Chantier fictif Alpha', 'facade'),
  ('20000000-0000-4000-8000-000000000222', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000202', 'Chantier fictif Beta', 'terrasse');

-- The test suite must execute the corrected trigger function and keep all five triggers active.
SELECT pg_temp.assert_true(
  position('TG_TABLE_NAME = ''devis_lignes''' IN pg_get_functiondef('public.proteger_document_financier_emis()'::regprocedure)) > 0
  AND position('TG_TABLE_NAME = ''facture_lignes''' IN pg_get_functiondef('public.proteger_document_financier_emis()'::regprocedure)) > 0
  AND position('TG_TABLE_NAME = ''avoir_lignes''' IN pg_get_functiondef('public.proteger_document_financier_emis()'::regprocedure)) > 0,
  'trigger function has explicit branches for all three line tables');
SELECT pg_temp.assert_true(
  (SELECT count(*) = 5 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
    'trg_devis_lignes_immutabilite','trg_factures_immutabilite','trg_facture_lignes_immutabilite',
    'trg_avoirs_immutabilite','trg_avoir_lignes_immutabilite') AND tgenabled = 'O'),
  'all immutability triggers are enabled');

-- An invalid cross-tenant composite relationship must fail even for the database owner.
SELECT pg_temp.expect_error($q$
  INSERT INTO public.devis (entreprise_id,client_id,date_validite,objet,metier)
  VALUES ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000202',CURRENT_DATE,'bad','facade')
$q$, 'fk_devis_client');

-- Authenticated tenant Alpha creates a multi-line quote; emission inserts its lines while parent is draft.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', true);
SELECT public.creer_devis_financier(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101',
  'chantier_id','10000000-0000-4000-8000-000000000111',
  'date_validite',(CURRENT_DATE + 30)::text,'objet','Devis test multi-lignes','metier','facade',
  'acompte_pct',30,
  'lignes',jsonb_build_array(
    jsonb_build_object('designation','Facade','quantite',10,'unite','m2','prix_unitaire_ht',100,'prix_revient_ht',40,'taux_tva',20,'type_cout','matiere'),
    jsonb_build_object('designation','Main oeuvre','quantite',5,'unite','h','prix_unitaire_ht',20,'prix_revient_ht',10,'taux_tva',10,'type_cout','main_oeuvre')
  )
)) AS quote_id \gset
SELECT set_config('test.quote_id', :'quote_id', true);
SELECT pg_temp.assert_true((SELECT total_ht=1100 AND total_tva=210 AND total_ttc=1310 AND statut='ENVOYE'
  FROM public.devis WHERE id=current_setting('test.quote_id')::uuid), 'quote HT/TVA/TTC totals and emitted state');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.devis_lignes WHERE devis_id=current_setting('test.quote_id')::uuid), 'two quote lines inserted');
SELECT pg_temp.assert_true((SELECT numero LIKE 'DEVIS-' || EXTRACT(YEAR FROM CURRENT_DATE)::int::text || '-%'
  FROM public.devis WHERE id=current_setting('test.quote_id')::uuid), 'quote numbering prefix and year');

-- Payload shape validation: run against all three financial RPCs.
SELECT pg_temp.expect_error('SELECT public.creer_devis_financier(NULL::jsonb)', 'PAYLOAD_SQL_NULL');
SELECT pg_temp.expect_error('SELECT public.creer_devis_financier(''[]''::jsonb)', 'PAYLOAD_FORMAT_INVALIDE');
SELECT pg_temp.expect_error('SELECT public.creer_devis_financier(''{}''::jsonb)', 'LIGNES_ABSENTES');
SELECT pg_temp.expect_error('SELECT public.creer_devis_financier(''{"lignes":null}''::jsonb)', 'LIGNES_NULL');
SELECT pg_temp.expect_error('SELECT public.creer_devis_financier(''{"lignes":{}}''::jsonb)', 'LIGNES_FORMAT_INVALIDE');
SELECT pg_temp.expect_error('SELECT public.creer_devis_financier(''{"lignes":[]}''::jsonb)', 'DEVIS_SANS_LIGNE');
SELECT pg_temp.expect_error('SELECT public.emettre_facture_financiere(NULL::jsonb)', 'PAYLOAD_SQL_NULL');
SELECT pg_temp.expect_error('SELECT public.emettre_facture_financiere(''[]''::jsonb)', 'PAYLOAD_FORMAT_INVALIDE');
SELECT pg_temp.expect_error('SELECT public.emettre_facture_financiere(''{}''::jsonb)', 'LIGNES_ABSENTES');
SELECT pg_temp.expect_error('SELECT public.emettre_facture_financiere(''{"lignes":null}''::jsonb)', 'LIGNES_NULL');
SELECT pg_temp.expect_error('SELECT public.emettre_facture_financiere(''{"lignes":{}}''::jsonb)', 'LIGNES_FORMAT_INVALIDE');
SELECT pg_temp.expect_error('SELECT public.emettre_facture_financiere(''{"lignes":[]}''::jsonb)', 'FACTURE_SANS_LIGNE');
SELECT pg_temp.expect_error('SELECT public.emettre_avoir_financier(NULL::jsonb)', 'PAYLOAD_SQL_NULL');
SELECT pg_temp.expect_error('SELECT public.emettre_avoir_financier(''[]''::jsonb)', 'PAYLOAD_FORMAT_INVALIDE');
SELECT pg_temp.expect_error('SELECT public.emettre_avoir_financier(''{}''::jsonb)', 'LIGNES_ABSENTES');
SELECT pg_temp.expect_error('SELECT public.emettre_avoir_financier(''{"lignes":null}''::jsonb)', 'LIGNES_NULL');
SELECT pg_temp.expect_error('SELECT public.emettre_avoir_financier(''{"lignes":{}}''::jsonb)', 'LIGNES_FORMAT_INVALIDE');
SELECT pg_temp.expect_error('SELECT public.emettre_avoir_financier(''{"lignes":[]}''::jsonb)', 'AVOIR_SANS_LIGNE');

SELECT public.marquer_devis_signe(current_setting('test.quote_id')::uuid);
SELECT pg_temp.assert_true((SELECT statut='SIGNE' FROM public.devis WHERE id=current_setting('test.quote_id')::uuid), 'quote signature transition');
SELECT pg_temp.expect_error(format('SELECT public.supprimer_devis_brouillon(%L::uuid)', current_setting('test.quote_id')), 'SEUL_UN_DEVIS_BROUILLON');
RESET ROLE;
SELECT pg_temp.expect_error(format('UPDATE public.devis_lignes SET designation=''changed'' WHERE devis_id=%L::uuid', current_setting('test.quote_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format('DELETE FROM public.devis_lignes WHERE devis_id=%L::uuid', current_setting('test.quote_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format($q$
  INSERT INTO public.devis_lignes (devis_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva,type_cout)
  VALUES (%L::uuid,'10000000-0000-4000-8000-000000000001','late quote line',1,'u',1,20,'matiere')
$q$, current_setting('test.quote_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');

-- A second tenant creates a separate quote. Alpha cannot read Beta's financial rows.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000022', true);
SELECT public.creer_devis_financier(jsonb_build_object(
  'client_id','20000000-0000-4000-8000-000000000202','date_validite',(CURRENT_DATE+30)::text,
  'objet','Devis Beta','metier','terrasse',
  'lignes',jsonb_build_array(jsonb_build_object('designation','Terrasse','quantite',2,'unite','m2','prix_unitaire_ht',50,'taux_tva',20,'type_cout','matiere'))
)) AS beta_quote_id \gset
SELECT set_config('test.beta_quote_id', :'beta_quote_id', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.devis WHERE id=current_setting('test.beta_quote_id')::uuid), 'RLS hides other tenant quote');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.devis_lignes WHERE entreprise_id='20000000-0000-4000-8000-000000000002'), 'RLS hides other tenant quote lines');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.factures WHERE entreprise_id='20000000-0000-4000-8000-000000000002'), 'RLS hides other tenant invoices');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.facture_lignes WHERE entreprise_id='20000000-0000-4000-8000-000000000002'), 'RLS hides other tenant invoice lines');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.avoirs WHERE entreprise_id='20000000-0000-4000-8000-000000000002'), 'RLS hides other tenant credit notes');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.avoir_lignes WHERE entreprise_id='20000000-0000-4000-8000-000000000002'), 'RLS hides other tenant credit note lines');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.credit_note_invoices WHERE entreprise_id='20000000-0000-4000-8000-000000000002'), 'RLS hides other tenant reservation links');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.devis WHERE id=current_setting('test.quote_id')::uuid), 'RLS allows owning tenant to read its quote');
SELECT pg_temp.expect_error($q$INSERT INTO public.devis (entreprise_id,client_id,date_validite,objet,metier)
  VALUES ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000101',CURRENT_DATE+1,'direct write denied','facade')$q$, 'permission denied');

-- Authenticated-only RPC permissions; anon must not execute write RPCs.
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT public.creer_devis_financier(''{}''::jsonb)', 'permission denied');
SELECT pg_temp.expect_error('SELECT public.emettre_facture_financiere(''{}''::jsonb)', 'permission denied');
SELECT pg_temp.expect_error('SELECT public.emettre_avoir_financier(''{}''::jsonb)', 'permission denied');
SET LOCAL ROLE authenticated;

-- Draft deletion is an allowed lifecycle operation (seeded as owner for this RPC test).
RESET ROLE;
INSERT INTO public.devis (id,entreprise_id,client_id,date_validite,objet,metier)
VALUES ('10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000101',CURRENT_DATE+30,'Brouillon supprimable','facade');
INSERT INTO public.devis_lignes (devis_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva,type_cout)
VALUES ('10000000-0000-4000-8000-000000000301','10000000-0000-4000-8000-000000000001','draft',1,'u',1,20,'matiere');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', true);
SELECT public.supprimer_devis_brouillon('10000000-0000-4000-8000-000000000301');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.devis WHERE id='10000000-0000-4000-8000-000000000301'), 'draft quote deletion cascades its lines');

-- Direct invoice: multiple VAT rates plus exact round-half-up line calculation.
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','chantier_id','10000000-0000-4000-8000-000000000111',
  'type','DIRECTE','objet','Facture directe test',
  'lignes',jsonb_build_array(
    jsonb_build_object('designation','Lot à 20','quantite',3,'unite','u','prix_unitaire_ht',100,'taux_tva',20),
    jsonb_build_object('designation','Lot à 10','quantite',1,'unite','u','prix_unitaire_ht',0.01,'taux_tva',10)
  )
)) AS direct_invoice_id \gset
SELECT set_config('test.direct_invoice_id', :'direct_invoice_id', true);
SELECT pg_temp.assert_true((SELECT total_ht=300.01 AND total_tva=60 AND total_ttc=360.01 AND statut='EMISE'
  FROM public.factures WHERE id=current_setting('test.direct_invoice_id')::uuid), 'direct invoice aggregate totals');
SELECT pg_temp.assert_true((SELECT date_emission=CURRENT_DATE AND numero LIKE 'FACTURE-' || EXTRACT(YEAR FROM CURRENT_DATE)::int::text || '-%'
  FROM public.factures WHERE id=current_setting('test.direct_invoice_id')::uuid), 'invoice emission date and number');
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','type','DIRECTE','objet','Arrondi demi-centime',
  'lignes',jsonb_build_array(jsonb_build_object('designation','0,005 HT','quantite',1,'unite','u','prix_unitaire_ht',0.005,'taux_tva',20))
)) AS rounding_invoice_id \gset
SELECT set_config('test.rounding_invoice_id', :'rounding_invoice_id', true);
SELECT pg_temp.assert_true((SELECT montant_ht=0.01 AND montant_tva=0 AND montant_ttc=0.01 FROM public.facture_lignes WHERE facture_id=current_setting('test.rounding_invoice_id')::uuid), 'half-up exact rounding at line level');

-- Cumulative advance (30%), situations (65%, then 80%) and final balance (100%).
SELECT id AS quote_line_1 FROM public.devis_lignes WHERE devis_id=current_setting('test.quote_id')::uuid AND designation='Facade' \gset
SELECT id AS quote_line_2 FROM public.devis_lignes WHERE devis_id=current_setting('test.quote_id')::uuid AND designation='Main oeuvre' \gset
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','devis_id',current_setting('test.quote_id'),
  'type','ACOMPTE','avancement_pct',30,'objet','Acompte 30%',
  'lignes',jsonb_build_array(
    jsonb_build_object('devis_ligne_id',:'quote_line_1','designation','Facade acompte','quantite',3,'unite','m2','prix_unitaire_ht',100,'taux_tva',20),
    jsonb_build_object('devis_ligne_id',:'quote_line_2','designation','Main oeuvre acompte','quantite',1.5,'unite','h','prix_unitaire_ht',20,'taux_tva',10)
  )
)) AS advance_id \gset
SELECT set_config('test.advance_id', :'advance_id', true);
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','devis_id',current_setting('test.quote_id'),
  'type','SITUATION','avancement_pct',65,'objet','Situation cumulative 65%',
  'lignes',jsonb_build_array(
    jsonb_build_object('devis_ligne_id',:'quote_line_1','designation','Facade situation 65','quantite',3.5,'unite','m2','prix_unitaire_ht',100,'taux_tva',20),
    jsonb_build_object('devis_ligne_id',:'quote_line_2','designation','Main oeuvre situation 65','quantite',1.75,'unite','h','prix_unitaire_ht',20,'taux_tva',10)
  )
)) AS situation_65_id \gset
SELECT set_config('test.situation_65_id', :'situation_65_id', true);
SELECT pg_temp.assert_true((SELECT sum(fl.quantite)=6.5 FROM public.devis_lignes dl JOIN public.factures f ON f.devis_id=dl.devis_id
  JOIN public.facture_lignes fl ON fl.facture_id=f.id AND fl.devis_ligne_id=dl.id
  WHERE dl.devis_id=current_setting('test.quote_id')::uuid AND dl.designation='Facade' AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')),
  'acompte 30 plus situation 65 bills 65 percent of first line');
SELECT pg_temp.assert_true((SELECT sum(fl.quantite)=3.25 FROM public.devis_lignes dl JOIN public.factures f ON f.devis_id=dl.devis_id
  JOIN public.facture_lignes fl ON fl.facture_id=f.id AND fl.devis_ligne_id=dl.id
  WHERE dl.devis_id=current_setting('test.quote_id')::uuid AND dl.designation='Main oeuvre' AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')),
  'acompte 30 plus situation 65 bills 65 percent of second line');
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','devis_id',current_setting('test.quote_id'),
  'type','SITUATION','avancement_pct',80,'objet','Situation cumulative 80%',
  'lignes',jsonb_build_array(
    jsonb_build_object('devis_ligne_id',:'quote_line_1','designation','Facade situation 80','quantite',1.5,'unite','m2','prix_unitaire_ht',100,'taux_tva',20),
    jsonb_build_object('devis_ligne_id',:'quote_line_2','designation','Main oeuvre situation 80','quantite',0.75,'unite','h','prix_unitaire_ht',20,'taux_tva',10)
  )
)) AS situation_80_id \gset
SELECT set_config('test.situation_80_id', :'situation_80_id', true);
SELECT pg_temp.assert_true((SELECT sum(fl.quantite)=8 FROM public.devis_lignes dl JOIN public.factures f ON f.devis_id=dl.devis_id
  JOIN public.facture_lignes fl ON fl.facture_id=f.id AND fl.devis_ligne_id=dl.id
  WHERE dl.devis_id=current_setting('test.quote_id')::uuid AND dl.designation='Facade' AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')),
  'situation 65 followed by situation 80 bills cumulative 80 percent of first line');
SELECT pg_temp.assert_true((SELECT sum(fl.quantite)=4 FROM public.devis_lignes dl JOIN public.factures f ON f.devis_id=dl.devis_id
  JOIN public.facture_lignes fl ON fl.facture_id=f.id AND fl.devis_ligne_id=dl.id
  WHERE dl.devis_id=current_setting('test.quote_id')::uuid AND dl.designation='Main oeuvre' AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE')),
  'situation 65 followed by situation 80 bills cumulative 80 percent of second line');
SELECT pg_temp.expect_error(format($q$
  SELECT public.emettre_facture_financiere(jsonb_build_object(
    'client_id','10000000-0000-4000-8000-000000000101','devis_id',%L,'type','SITUATION','avancement_pct',100,'objet','Over 100',
    'lignes',jsonb_build_array(jsonb_build_object('devis_ligne_id',%L,'designation','over','quantite',2.01,'unite','m2','prix_unitaire_ht',100,'taux_tva',20))))
$q$, current_setting('test.quote_id'), :'quote_line_1'), 'AVANCEMENT_CUMULE_DEPASSE');
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','devis_id',current_setting('test.quote_id'),
  'type','SOLDE','avancement_pct',100,'objet','Solde final',
  'lignes',jsonb_build_array(
    jsonb_build_object('devis_ligne_id',:'quote_line_1','designation','Facade solde','quantite',2,'unite','m2','prix_unitaire_ht',100,'taux_tva',20),
    jsonb_build_object('devis_ligne_id',:'quote_line_2','designation','Main oeuvre solde','quantite',1,'unite','h','prix_unitaire_ht',20,'taux_tva',10)
  )
)) AS balance_id \gset
SELECT set_config('test.balance_id', :'balance_id', true);
SELECT pg_temp.assert_true((SELECT sum(fl.quantite)=dl.quantite FROM public.devis_lignes dl JOIN public.facture_lignes fl ON fl.devis_ligne_id=dl.id
  JOIN public.factures f ON f.id=fl.facture_id WHERE dl.devis_id=current_setting('test.quote_id')::uuid AND dl.id=:'quote_line_1'
  AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE') GROUP BY dl.id,dl.quantite), 'first quote line fully billed at balance');
SELECT pg_temp.assert_true((SELECT sum(fl.quantite)=dl.quantite FROM public.devis_lignes dl JOIN public.facture_lignes fl ON fl.devis_ligne_id=dl.id
  JOIN public.factures f ON f.id=fl.facture_id WHERE dl.devis_id=current_setting('test.quote_id')::uuid AND dl.id=:'quote_line_2'
  AND f.statut IN ('EMISE','PARTIELLEMENT_PAYEE','PAYEE') GROUP BY dl.id,dl.quantite), 'second quote line fully billed at balance');

-- Emitted invoice header and line protections, including UPDATE, DELETE, INSERT, and line transfer.
SELECT pg_temp.expect_error(format('UPDATE public.factures SET objet=''altered'' WHERE id=%L::uuid', current_setting('test.direct_invoice_id')), 'permission denied');
SELECT pg_temp.expect_error(format('DELETE FROM public.factures WHERE id=%L::uuid', current_setting('test.direct_invoice_id')), 'permission denied');
RESET ROLE;
UPDATE public.factures SET statut='PARTIELLEMENT_PAYEE' WHERE id=current_setting('test.direct_invoice_id')::uuid;
SELECT pg_temp.assert_true((SELECT statut='PARTIELLEMENT_PAYEE' FROM public.factures WHERE id=current_setting('test.direct_invoice_id')::uuid), 'valid invoice payment status transition remains allowed');
SELECT pg_temp.expect_error(format('UPDATE public.facture_lignes SET designation=''altered'' WHERE facture_id=%L::uuid', current_setting('test.direct_invoice_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format('DELETE FROM public.facture_lignes WHERE facture_id=%L::uuid', current_setting('test.direct_invoice_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format($q$
  INSERT INTO public.facture_lignes (facture_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
  VALUES (%L::uuid,'10000000-0000-4000-8000-000000000001','late line',1,'u',1,20)
$q$, current_setting('test.direct_invoice_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format($q$
  UPDATE public.facture_lignes SET facture_id='10000000-0000-4000-8000-000000000402'
  WHERE id=(SELECT id FROM public.facture_lignes WHERE facture_id=%L::uuid LIMIT 1)
$q$, current_setting('test.direct_invoice_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');

-- Targeted credit note and per-rate limits.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', true);
SELECT public.emettre_avoir_financier(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','scope','INVOICE','origin_invoice_id',current_setting('test.direct_invoice_id'),
  'objet','Avoir ciblé test',
  'lignes',jsonb_build_array(jsonb_build_object('designation','Correction taux 20','quantite',0.1,'unite','u','prix_unitaire_ht',100,'taux_tva',20))
)) AS targeted_credit_id \gset
SELECT set_config('test.targeted_credit_id', :'targeted_credit_id', true);
SELECT pg_temp.assert_true((SELECT total_ht=10 AND total_tva=2 AND total_ttc=12 AND statut='EMIS'
  FROM public.avoirs WHERE id=current_setting('test.targeted_credit_id')::uuid), 'targeted credit totals');
SELECT pg_temp.expect_error(format($q$
  SELECT public.emettre_avoir_financier(jsonb_build_object(
    'client_id','10000000-0000-4000-8000-000000000101','scope','INVOICE','origin_invoice_id',%L,
    'objet','Avoir dépassement',
    'lignes',jsonb_build_array(jsonb_build_object('designation','taux insuffisant','quantite',3,'unite','u','prix_unitaire_ht',100,'taux_tva',20))))
$q$, current_setting('test.direct_invoice_id')), 'PLAFOND_AVOIR_DEPASSE');

-- Contract-wide global credit freezes its resolved invoice set; a later invoice remains outside that set.
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','type','DIRECTE','contract_ref','ACCORD-TEST-1','objet','Facture contrat initiale',
  'lignes',jsonb_build_array(jsonb_build_object('designation','Contrat','quantite',10,'unite','u','prix_unitaire_ht',100,'taux_tva',20))
)) AS contract_invoice_id \gset
SELECT set_config('test.contract_invoice_id', :'contract_invoice_id', true);
SELECT public.emettre_avoir_financier(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','scope','GLOBAL','global_basis','CONTRACT',
  'contract_ref','ACCORD-TEST-1','period_start',(CURRENT_DATE-1)::text,'period_end',(CURRENT_DATE+1)::text,
  'objet','Avoir global contrat',
  'lignes',jsonb_build_array(jsonb_build_object('designation','Remise contrat','quantite',1,'unite','u','prix_unitaire_ht',100,'taux_tva',20))
)) AS global_contract_credit_id \gset
SELECT set_config('test.global_contract_credit_id', :'global_contract_credit_id', true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.credit_note_invoices WHERE credit_note_id=current_setting('test.global_contract_credit_id')::uuid
  AND invoice_id=current_setting('test.contract_invoice_id')::uuid), 'CONTRACT resolved invoice frozen in link table');
SELECT pg_temp.expect_error(format($q$
  SELECT public.emettre_avoir_financier(jsonb_build_object(
    'client_id','10000000-0000-4000-8000-000000000101','scope','INVOICE','origin_invoice_id',%L,
    'objet','Avoir après réservation','lignes',jsonb_build_array(jsonb_build_object('designation','reserved','quantite',0.1,'unite','u','prix_unitaire_ht',100,'taux_tva',20))))
$q$, current_setting('test.contract_invoice_id')), 'FACTURE_ORIGINE_INELIGIBLE');
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','type','DIRECTE','contract_ref','ACCORD-TEST-1','objet','Facture contrat tardive',
  'lignes',jsonb_build_array(jsonb_build_object('designation','Nouvelle facture','quantite',2,'unite','u','prix_unitaire_ht',100,'taux_tva',20))
)) AS late_contract_invoice_id \gset
SELECT set_config('test.late_contract_invoice_id', :'late_contract_invoice_id', true);
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.credit_note_invoices
  WHERE credit_note_id=current_setting('test.global_contract_credit_id')::uuid AND invoice_id=current_setting('test.late_contract_invoice_id')::uuid),
  'invoice emitted after global issuance is not added retroactively');

-- Explicit invoice-set global credit: duplicate ids are deduplicated; a reserved invoice cannot be reused.
SELECT public.emettre_facture_financiere(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','type','DIRECTE','objet','Facture sélection globale',
  'lignes',jsonb_build_array(
    jsonb_build_object('designation','Taux 20','quantite',2,'unite','u','prix_unitaire_ht',100,'taux_tva',20),
    jsonb_build_object('designation','Taux 10','quantite',10,'unite','u','prix_unitaire_ht',10,'taux_tva',10)
  )
)) AS selected_invoice_id \gset
SELECT set_config('test.selected_invoice_id', :'selected_invoice_id', true);
SELECT pg_temp.expect_error(format($q$
  SELECT public.emettre_avoir_financier(jsonb_build_object(
    'client_id','10000000-0000-4000-8000-000000000101','scope','GLOBAL','global_basis','INVOICES',
    'period_start',(CURRENT_DATE-1)::text,'period_end',(CURRENT_DATE+1)::text,'invoice_ids',jsonb_build_array(%L),
    'objet','Plafond global par taux','lignes',jsonb_build_array(jsonb_build_object('designation','depasse taux 10','quantite',10.1,'unite','u','prix_unitaire_ht',10,'taux_tva',10))))
$q$, current_setting('test.selected_invoice_id')), 'PLAFOND_GLOBAL_DEPASSE');
SELECT public.emettre_avoir_financier(jsonb_build_object(
  'client_id','10000000-0000-4000-8000-000000000101','scope','GLOBAL','global_basis','INVOICES',
  'period_start',(CURRENT_DATE-1)::text,'period_end',(CURRENT_DATE+1)::text,
  'invoice_ids',jsonb_build_array(current_setting('test.selected_invoice_id'),current_setting('test.selected_invoice_id')),
  'objet','Avoir global sélection',
  'lignes',jsonb_build_array(jsonb_build_object('designation','Global 20','quantite',1,'unite','u','prix_unitaire_ht',100,'taux_tva',20))
)) AS global_invoice_credit_id \gset
SELECT set_config('test.global_invoice_credit_id', :'global_invoice_credit_id', true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.credit_note_invoices WHERE credit_note_id=current_setting('test.global_invoice_credit_id')::uuid), 'INVOICES selection deduplicates repeated invoice');
SELECT pg_temp.expect_error(format($q$
  SELECT public.emettre_avoir_financier(jsonb_build_object(
    'client_id','10000000-0000-4000-8000-000000000101','scope','GLOBAL','global_basis','INVOICES',
    'period_start',(CURRENT_DATE-1)::text,'period_end',(CURRENT_DATE+1)::text,'invoice_ids',jsonb_build_array(%L),
    'objet','Double réservation','lignes',jsonb_build_array(jsonb_build_object('designation','dup','quantite',0.1,'unite','u','prix_unitaire_ht',100,'taux_tva',20))))
$q$, current_setting('test.selected_invoice_id')), 'FACTURE_PERIMETRE_INELIGIBLE');

-- Header/line immutability for issued credits, plus status irrevocability.
RESET ROLE;
SELECT pg_temp.expect_error(format('UPDATE public.avoir_lignes SET designation=''altered'' WHERE avoir_id=%L::uuid', current_setting('test.targeted_credit_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format('DELETE FROM public.avoir_lignes WHERE avoir_id=%L::uuid', current_setting('test.targeted_credit_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format($q$
  INSERT INTO public.avoir_lignes (avoir_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
  VALUES (%L::uuid,'10000000-0000-4000-8000-000000000001','late line',1,'u',1,20)
$q$, current_setting('test.targeted_credit_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format($q$
  UPDATE public.avoir_lignes SET avoir_id='10000000-0000-4000-8000-000000000403'
  WHERE id=(SELECT id FROM public.avoir_lignes WHERE avoir_id=%L::uuid LIMIT 1)
$q$, current_setting('test.targeted_credit_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');
SELECT pg_temp.expect_error(format('UPDATE public.avoirs SET statut=''ANNULE'' WHERE id=%L::uuid', current_setting('test.targeted_credit_id')), 'AVOIR_EMIS_IRREVOCABLE');
SELECT pg_temp.expect_error(format('DELETE FROM public.avoirs WHERE id=%L::uuid', current_setting('test.targeted_credit_id')), 'DOCUMENT_EMIS_IMMUABLE');

-- Each line table: valid draft INSERT/UPDATE/DELETE, invalid/nonexistent/wrong-tenant parent,
-- issued-parent INSERT/UPDATE/DELETE and issued-to-draft move are exercised with active triggers.
INSERT INTO public.devis (id,entreprise_id,client_id,date_validite,objet,metier)
VALUES ('10000000-0000-4000-8000-000000000401','10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000101',CURRENT_DATE+30,'Draft trigger quote','facade');
INSERT INTO public.factures (id,entreprise_id,client_id,statut,type,objet)
VALUES ('10000000-0000-4000-8000-000000000402','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000101','BROUILLON','DIRECTE','Draft trigger invoice');
INSERT INTO public.avoirs (id,entreprise_id,client_id,scope,origin_invoice_id,objet)
VALUES ('10000000-0000-4000-8000-000000000403','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000101','INVOICE',current_setting('test.rounding_invoice_id')::uuid,'Draft trigger credit');
SELECT pg_temp.expect_error(format($q$
  UPDATE public.devis_lignes SET devis_id='10000000-0000-4000-8000-000000000401'
  WHERE devis_id=%L::uuid
$q$, current_setting('test.quote_id')), 'LIGNES_DOCUMENT_EMIS_IMMUABLES');

INSERT INTO public.devis_lignes (devis_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva,type_cout)
VALUES ('10000000-0000-4000-8000-000000000401','10000000-0000-4000-8000-000000000001','draft insert',1,'u',1,20,'matiere');
UPDATE public.devis_lignes SET designation='draft updated' WHERE devis_id='10000000-0000-4000-8000-000000000401';
DELETE FROM public.devis_lignes WHERE devis_id='10000000-0000-4000-8000-000000000401';
INSERT INTO public.facture_lignes (facture_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
VALUES ('10000000-0000-4000-8000-000000000402','10000000-0000-4000-8000-000000000001','draft insert',1,'u',1,20);
UPDATE public.facture_lignes SET designation='draft updated' WHERE facture_id='10000000-0000-4000-8000-000000000402';
DELETE FROM public.facture_lignes WHERE facture_id='10000000-0000-4000-8000-000000000402';
INSERT INTO public.avoir_lignes (avoir_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
VALUES ('10000000-0000-4000-8000-000000000403','10000000-0000-4000-8000-000000000001','draft insert',1,'u',1,20);
UPDATE public.avoir_lignes SET designation='draft updated' WHERE avoir_id='10000000-0000-4000-8000-000000000403';
DELETE FROM public.avoir_lignes WHERE avoir_id='10000000-0000-4000-8000-000000000403';

SELECT pg_temp.expect_error($q$INSERT INTO public.devis_lignes (devis_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva,type_cout)
  VALUES ('90000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','no parent',1,'u',1,20,'matiere')$q$, 'DOCUMENT_PARENT_INVALIDE');
SELECT pg_temp.expect_error($q$INSERT INTO public.facture_lignes (facture_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
  VALUES ('90000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','no parent',1,'u',1,20)$q$, 'DOCUMENT_PARENT_INVALIDE');
SELECT pg_temp.expect_error($q$INSERT INTO public.avoir_lignes (avoir_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
  VALUES ('90000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','no parent',1,'u',1,20)$q$, 'DOCUMENT_PARENT_INVALIDE');
SELECT pg_temp.expect_error($q$INSERT INTO public.devis_lignes (devis_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva,type_cout)
  VALUES ('10000000-0000-4000-8000-000000000401','20000000-0000-4000-8000-000000000002','wrong tenant',1,'u',1,20,'matiere')$q$, 'DOCUMENT_PARENT_INVALIDE');
SELECT pg_temp.expect_error($q$INSERT INTO public.facture_lignes (facture_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
  VALUES ('10000000-0000-4000-8000-000000000402','20000000-0000-4000-8000-000000000002','wrong tenant',1,'u',1,20)$q$, 'DOCUMENT_PARENT_INVALIDE');
SELECT pg_temp.expect_error($q$INSERT INTO public.avoir_lignes (avoir_id,entreprise_id,designation,quantite,unite,prix_unitaire_ht,taux_tva)
  VALUES ('10000000-0000-4000-8000-000000000403','20000000-0000-4000-8000-000000000002','wrong tenant',1,'u',1,20)$q$, 'DOCUMENT_PARENT_INVALIDE');

-- Drop seeded draft invoice/credit to prove their line triggers permit nested cascade deletes.
DELETE FROM public.factures WHERE id='10000000-0000-4000-8000-000000000402';
DELETE FROM public.avoirs WHERE id='10000000-0000-4000-8000-000000000403';
SELECT pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.facture_lignes WHERE facture_id='10000000-0000-4000-8000-000000000402')
  AND NOT EXISTS (SELECT 1 FROM public.avoir_lignes WHERE avoir_id='10000000-0000-4000-8000-000000000403'), 'draft invoice and credit cascades work with triggers active');

-- Number sequences are unique per enterprise/document type, and emitted numbers have stable prefixes.
SELECT pg_temp.assert_true((SELECT count(*)=count(DISTINCT numero) FROM public.factures WHERE entreprise_id='10000000-0000-4000-8000-000000000001'), 'invoice numbers unique within enterprise');
SELECT pg_temp.assert_true((SELECT count(*)=count(DISTINCT numero) FROM public.avoirs WHERE entreprise_id='10000000-0000-4000-8000-000000000001'), 'credit note numbers unique within enterprise');

ROLLBACK;
\echo 'Finance Phase 1: tous les scénarios SQL ont réussi; transaction annulée, aucune fixture persistée.'
