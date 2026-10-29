import { MetierType } from "./metier";

export type UserRole = "dirigeant" | "chantier" | "commercial" | "administratif";
export type TypeClient = "particulier" | "professionnel";
export type StatutChantier = "a_venir" | "en_cours" | "termine" | "en_pause";

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
    };
  };
};
