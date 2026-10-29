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
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChantierRow {
  id: string;
  entreprise_id: string;
  client_id: string;
  nom: string;
  metier: MetierType;
  statut: StatutChantier;
  description: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  date_debut_prevue: string | null;
  date_fin_prevue: string | null;
  avancement: number;
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
  created_at: string;
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

export type Database = {
  public: {
    Tables: {
      entreprises: {
        Row: EntrepriseRow;
        Insert: Omit<EntrepriseRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<EntrepriseRow, "id">>;
      };
      profils: {
        Row: ProfilRow;
        Insert: Omit<ProfilRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ProfilRow, "id">>;
      };
      clients: {
        Row: ClientRow;
        Insert: Omit<ClientRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ClientRow, "id">>;
      };
      chantiers: {
        Row: ChantierRow;
        Insert: Omit<ChantierRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ChantierRow, "id">>;
      };
      calepinages: {
        Row: CalepinageRow;
        Insert: Omit<CalepinageRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<CalepinageRow, "id">>;
      };
      calepinages_terrasse: {
        Row: CalepinageTerrasseRow;
        Insert: Omit<CalepinageTerrasseRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<CalepinageTerrasseRow, "id">>;
      };
      besoins_materiaux: {
        Row: BesoinMateriauRow;
        Insert: Omit<BesoinMateriauRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<BesoinMateriauRow, "id">>;
      };
    };
  };
};
