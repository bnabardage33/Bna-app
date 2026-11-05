import { MetierType } from "./metier";

export type UserRole = "dirigeant" | "chantier" | "commercial" | "administratif";
export type TypeClient = "particulier" | "professionnel";
export type StatutChantier = "a_venir" | "en_cours" | "termine" | "en_pause";
export type StatutCalepinage = "brouillon" | "valide" | "archive";
export type StatutBesoin = "a_commander" | "commande" | "recu" | "annule";
export type TypeFixationTerrasse = "vis" | "clips";

export interface EntrepriseRow {
  id: string;
  nom: string;
  nom_commercial: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  siret: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfilRow {
  id: string;
  entreprise_id: string;
  prenom: string;
  nom: string;
  role: UserRole;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientRow {
  id: string;
  entreprise_id: string;
  type_client: TypeClient;
  nom: string;
  prenom: string | null;
  societe: string | null;
  nom_commercial: string | null;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  telephone_secondaire: string | null;
  adresse: string | null;
  adresse_complement: string | null;
  code_postal: string | null;
  ville: string | null;
  notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactClientRow {
  id: string;
  entreprise_id: string;
  client_id: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
  est_principal: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChantierRow {
  id: string;
  entreprise_id: string;
  client_id: string;
  contact_id: string | null;
  nom: string;
  metier: MetierType;
  statut: StatutChantier;
  description: string | null;
  adresse: string | null;
  adresse_complement: string | null;
  code_postal: string | null;
  ville: string | null;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  avancement: number;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalepinageRow {
  id: string;
  entreprise_id: string;
  chantier_id: string;
  metier: MetierType;
  version: number;
  statut: StatutCalepinage;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalepinageTerrasseRow {
  id: string;
  calepinage_id: string;
  entreprise_id: string;
  longueur_m: number;
  largeur_m: number;
  orientation_lames: string;
  largeur_lame_mm: number;
  longueur_lame_m: number;
  espace_inter_lames_mm: number;
  entraxe_lambourdes_cm: number;
  entraxe_plots_cm: number;
  type_fixation: TypeFixationTerrasse;
  marge_chutes_pct: number;
  surface_m2: number;
  ml_lames: number;
  nb_lames: number;
  ml_lambourdes: number;
  nb_lambourdes: number;
  nb_plots: number;
  nb_fixations: number;
  disposition_joints?: "alignes" | "quinconce";
  parametres?: Record<string, unknown> | null;
  resultats?: Record<string, unknown> | null;
  created_at: string;
}

export type StatutCommandeFournisseur =
  | "brouillon"
  | "envoyee"
  | "commandee"
  | "annulee";

export interface FournisseurRow {
  id: string;
  entreprise_id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommandeFournisseurRow {
  id: string;
  entreprise_id: string;
  chantier_id: string;
  fournisseur_id: string;
  version_source_id: string | null;
  version_source_numero: number | null;
  numero_commande: string;
  statut: StatutCommandeFournisseur;
  date_commande: string;
  commentaire: string | null;
  reference_fournisseur: string | null;
  date_livraison_souhaitee: string | null;
  piece_jointe_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneCommandeFournisseurRow {
  id: string;
  commande_id: string;
  besoin_source_id: string | null;
  designation: string;
  categorie: string;
  unite: string;
  quantite: number;
  created_at: string;
}

export interface PhotoChantierRow {
  id: string;
  entreprise_id: string;
  chantier_id: string;
  type: "constat" | "pointage";
  titre: string;
  description: string | null;
  localisation: string | null;
  storage_path: string;
  url: string;
  date: string;
  heure: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BesoinMateriauRow {
  id: string;
  entreprise_id: string;
  chantier_id: string;
  calepinage_id: string | null;
  categorie: string;
  designation: string;
  unite: string;
  quantite: number;
  origine: "calepinage" | "manuel" | "import";
  statut: StatutBesoin;
  created_at: string;
  updated_at: string;
}

export type StatutDevisFinanceDb = "BROUILLON" | "ENVOYE" | "SIGNE" | "REFUSE" | "ANNULE";
export type StatutFactureFinanceDb = "BROUILLON" | "EMISE" | "PARTIELLEMENT_PAYEE" | "PAYEE" | "ANNULEE";
export type StatutAvoirDb = "BROUILLON" | "EMIS" | "ANNULE";
export type ScopeAvoirDb = "INVOICE" | "GLOBAL";
export type BaseAvoirGlobalDb = "CONTRACT" | "INVOICES";

export interface DevisFinanceRow {
  id: string; entreprise_id: string; client_id: string; chantier_id: string | null; numero: string | null;
  statut: StatutDevisFinanceDb; date_creation: string; date_emission: string | null; date_validite: string;
  objet: string; metier: MetierType; acompte_pct: number; retenue_garantie_pct: number;
  total_ht: number; total_tva: number; total_ttc: number; notes: string | null; created_at: string; updated_at: string;
}
export interface DevisLigneFinanceRow {
  id: string; devis_id: string; entreprise_id: string; designation: string; description: string | null;
  quantite: number; unite: string; prix_unitaire_ht: number; prix_revient_ht: number; taux_tva: number;
  type_cout: "matiere" | "main_oeuvre"; montant_ht: number | null; montant_tva: number | null; montant_ttc: number | null; created_at: string;
}
export interface FactureFinanceRow {
  id: string; entreprise_id: string; client_id: string; devis_id: string | null; chantier_id: string | null;
  numero: string | null; statut: StatutFactureFinanceDb; type: "ACOMPTE" | "SITUATION" | "SOLDE" | "DIRECTE";
  date_emission: string | null; date_echeance: string | null; contract_ref: string | null; objet: string;
  avancement_pct: number | null; retenue_garantie_pct: number; montant_retenue_ttc: number;
  total_ht: number; total_tva: number; total_ttc: number; created_at: string; updated_at: string;
}
export interface FactureLigneFinanceRow {
  id: string; facture_id: string; entreprise_id: string; devis_ligne_id: string | null; designation: string;
  quantite: number; unite: string; prix_unitaire_ht: number; taux_tva: number; montant_ht: number | null;
  montant_tva: number | null; montant_ttc: number | null; created_at: string;
}
export interface AvoirFinanceRow {
  id: string; entreprise_id: string; client_id: string; scope: ScopeAvoirDb; origin_invoice_id: string | null;
  period_start: string | null; period_end: string | null; global_basis: BaseAvoirGlobalDb | null;
  contract_ref: string | null; numero: string | null; statut: StatutAvoirDb; date_emission: string | null;
  objet: string; total_ht: number; total_tva: number; total_ttc: number; created_at: string; updated_at: string;
}
export interface AvoirLigneFinanceRow {
  id: string; avoir_id: string; entreprise_id: string; designation: string; quantite: number; unite: string;
  prix_unitaire_ht: number; taux_tva: number; montant_ht: number | null; montant_tva: number | null; montant_ttc: number | null; created_at: string;
}
export interface CreditNoteInvoiceRow { credit_note_id: string; invoice_id: string; entreprise_id: string; client_id: string; created_at: string; }

type FinanceInsert<T, Required extends keyof T> = Pick<T, Required> & Partial<Omit<T, Required>>;
type FinanceLineInsert<T, Required extends keyof T> = Pick<T, Required> & Partial<Omit<T, Required | "montant_ht" | "montant_tva" | "montant_ttc">>;
type DbCompatibleTables<T> = {
  [K in keyof T]: T[K] extends { Row: infer R; Insert: infer I; Update: infer U; Relationships: infer Rel }
    ? { Row: R & Record<string, unknown>; Insert: I & Record<string, unknown>; Update: U & Record<string, unknown>; Relationships: Rel }
    : never;
};

type FinanceRelationship<
  Name extends string,
  Columns extends string[],
  Relation extends string,
  ReferencedColumns extends string[],
> = { foreignKeyName: Name; columns: Columns; isOneToOne: false; referencedRelation: Relation; referencedColumns: ReferencedColumns };

type DevisFinanceRelationships = [
  FinanceRelationship<"devis_entreprise_id_fkey", ["entreprise_id"], "entreprises", ["id"]>,
  FinanceRelationship<"fk_devis_chantier", ["chantier_id", "entreprise_id", "client_id"], "chantiers", ["id", "entreprise_id", "client_id"]>,
  FinanceRelationship<"fk_devis_client", ["client_id", "entreprise_id"], "clients", ["id", "entreprise_id"]>,
];
type DevisLigneFinanceRelationships = [
  FinanceRelationship<"devis_lignes_entreprise_id_fkey", ["entreprise_id"], "entreprises", ["id"]>,
  FinanceRelationship<"fk_devis_lignes_parent", ["devis_id", "entreprise_id"], "devis", ["id", "entreprise_id"]>,
];
type FactureFinanceRelationships = [
  FinanceRelationship<"factures_entreprise_id_fkey", ["entreprise_id"], "entreprises", ["id"]>,
  FinanceRelationship<"fk_factures_chantier", ["chantier_id", "entreprise_id", "client_id"], "chantiers", ["id", "entreprise_id", "client_id"]>,
  FinanceRelationship<"fk_factures_client", ["client_id", "entreprise_id"], "clients", ["id", "entreprise_id"]>,
  FinanceRelationship<"fk_factures_devis", ["devis_id", "entreprise_id", "client_id"], "devis", ["id", "entreprise_id", "client_id"]>,
];
type FactureLigneFinanceRelationships = [
  FinanceRelationship<"facture_lignes_entreprise_id_fkey", ["entreprise_id"], "entreprises", ["id"]>,
  FinanceRelationship<"fk_facture_lignes_devis_ligne", ["devis_ligne_id", "entreprise_id"], "devis_lignes", ["id", "entreprise_id"]>,
  FinanceRelationship<"fk_facture_lignes_parent", ["facture_id", "entreprise_id"], "factures", ["id", "entreprise_id"]>,
];
type AvoirFinanceRelationships = [
  FinanceRelationship<"avoirs_entreprise_id_fkey", ["entreprise_id"], "entreprises", ["id"]>,
  FinanceRelationship<"fk_avoirs_client", ["client_id", "entreprise_id"], "clients", ["id", "entreprise_id"]>,
  FinanceRelationship<"fk_avoirs_origin_invoice", ["origin_invoice_id", "entreprise_id", "client_id"], "factures", ["id", "entreprise_id", "client_id"]>,
];
type AvoirLigneFinanceRelationships = [
  FinanceRelationship<"avoir_lignes_entreprise_id_fkey", ["entreprise_id"], "entreprises", ["id"]>,
  FinanceRelationship<"fk_avoir_lignes_parent", ["avoir_id", "entreprise_id"], "avoirs", ["id", "entreprise_id"]>,
];
type CreditNoteInvoiceRelationships = [
  FinanceRelationship<"fk_credit_note_invoice_invoice", ["invoice_id", "entreprise_id", "client_id"], "factures", ["id", "entreprise_id", "client_id"]>,
  FinanceRelationship<"fk_credit_note_invoice_note", ["credit_note_id", "entreprise_id", "client_id"], "avoirs", ["id", "entreprise_id", "client_id"]>,
];

export type Database = {
  public: {
    Tables: DbCompatibleTables<{
      entreprises: {
        Row: EntrepriseRow;
        Insert: Omit<EntrepriseRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<EntrepriseRow, "id">>;
        Relationships: [];
      };
      profils: {
        Row: ProfilRow;
        Insert: Omit<ProfilRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ProfilRow, "id">>;
        Relationships: [];
      };
      clients: {
        Row: ClientRow;
        Insert: Omit<ClientRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ClientRow, "id">>;
        Relationships: [];
      };
      contacts_clients: {
        Row: ContactClientRow;
        Insert: Omit<ContactClientRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ContactClientRow, "id">>;
        Relationships: [];
      };
      chantiers: {
        Row: ChantierRow;
        Insert: Omit<ChantierRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ChantierRow, "id">>;
        Relationships: [];
      };
      calepinages: {
        Row: CalepinageRow;
        Insert: Omit<CalepinageRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CalepinageRow, "id">>;
        Relationships: [];
      };
      calepinages_terrasse: {
        Row: CalepinageTerrasseRow;
        Insert: Omit<CalepinageTerrasseRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CalepinageTerrasseRow, "id">>;
        Relationships: [];
      };
      besoins_materiaux: {
        Row: BesoinMateriauRow;
        Insert: Omit<BesoinMateriauRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<BesoinMateriauRow, "id">>;
        Relationships: [];
      };
      fournisseurs: {
        Row: FournisseurRow;
        Insert: Omit<FournisseurRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<FournisseurRow, "id">>;
        Relationships: [];
      };
      commandes_fournisseurs: {
        Row: CommandeFournisseurRow;
        Insert: Omit<CommandeFournisseurRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CommandeFournisseurRow, "id">>;
        Relationships: [];
      };
      lignes_commande_fournisseur: {
        Row: LigneCommandeFournisseurRow;
        Insert: Omit<LigneCommandeFournisseurRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<LigneCommandeFournisseurRow, "id">>;
        Relationships: [];
      };
      photos_chantiers: {
        Row: PhotoChantierRow;
        Insert: Omit<PhotoChantierRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<PhotoChantierRow, "id">>;
        Relationships: [];
      };
      devis: { Row: DevisFinanceRow; Insert: FinanceInsert<DevisFinanceRow, "entreprise_id" | "client_id" | "date_validite" | "objet" | "metier">; Update: Partial<Omit<DevisFinanceRow, "id">>; Relationships: DevisFinanceRelationships };
      devis_lignes: { Row: DevisLigneFinanceRow; Insert: FinanceLineInsert<DevisLigneFinanceRow, "devis_id" | "entreprise_id" | "designation" | "quantite" | "unite" | "prix_unitaire_ht" | "taux_tva" | "type_cout">; Update: Partial<Omit<DevisLigneFinanceRow, "id" | "montant_ht" | "montant_tva" | "montant_ttc">>; Relationships: DevisLigneFinanceRelationships };
      factures: { Row: FactureFinanceRow; Insert: FinanceInsert<FactureFinanceRow, "entreprise_id" | "client_id" | "type" | "objet">; Update: Partial<Omit<FactureFinanceRow, "id">>; Relationships: FactureFinanceRelationships };
      facture_lignes: { Row: FactureLigneFinanceRow; Insert: FinanceLineInsert<FactureLigneFinanceRow, "facture_id" | "entreprise_id" | "designation" | "quantite" | "unite" | "prix_unitaire_ht" | "taux_tva">; Update: Partial<Omit<FactureLigneFinanceRow, "id" | "montant_ht" | "montant_tva" | "montant_ttc">>; Relationships: FactureLigneFinanceRelationships };
      avoirs: { Row: AvoirFinanceRow; Insert: FinanceInsert<AvoirFinanceRow, "entreprise_id" | "client_id" | "scope" | "objet">; Update: Partial<Omit<AvoirFinanceRow, "id">>; Relationships: AvoirFinanceRelationships };
      avoir_lignes: { Row: AvoirLigneFinanceRow; Insert: FinanceLineInsert<AvoirLigneFinanceRow, "avoir_id" | "entreprise_id" | "designation" | "quantite" | "unite" | "prix_unitaire_ht" | "taux_tva">; Update: Partial<Omit<AvoirLigneFinanceRow, "id" | "montant_ht" | "montant_tva" | "montant_ttc">>; Relationships: AvoirLigneFinanceRelationships };
      credit_note_invoices: { Row: CreditNoteInvoiceRow; Insert: FinanceInsert<CreditNoteInvoiceRow, "credit_note_id" | "invoice_id" | "entreprise_id" | "client_id">; Update: Partial<CreditNoteInvoiceRow>; Relationships: CreditNoteInvoiceRelationships };
    }>;
    Views: { [_ in never]: never };
    Functions: {
      allouer_numero_financier: { Args: { p_date: string; p_type: string }; Returns: string };
      creer_devis_financier: { Args: { p_payload: Json }; Returns: string };
      emettre_facture_financiere: { Args: { p_payload: Json }; Returns: string };
      emettre_avoir_financier: { Args: { p_payload: Json }; Returns: string };
      marquer_devis_signe: { Args: { p_devis_id: string }; Returns: undefined };
      supprimer_devis_brouillon: { Args: { p_devis_id: string }; Returns: undefined };
      get_auth_entreprise_id: { Args: never; Returns: string | null };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
