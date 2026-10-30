export type MetierType = "facade" | "terrasse" | "cloture";

export interface MetierConfig {
  label: string;
  badgeColor: string;
  termes: {
    structure: string;
    revetement: string;
    unitePrincipale: string;
  };
}

export const METIERS_CONFIG: Record<MetierType, MetierConfig> = {
  facade: {
    label: "Façade / Bardage",
    badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
    termes: {
      structure: "Ossature & isolant",
      revetement: "Panneaux / Lames de bardage",
      unitePrincipale: "m²",
    },
  },
  terrasse: {
    label: "Terrasse",
    badgeColor: "bg-orange-50 text-bna-copper border-orange-200",
    termes: {
      structure: "Lambourdes & plots",
      revetement: "Platelage lames",
      unitePrincipale: "m²",
    },
  },
  cloture: {
    label: "Clôture",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    termes: {
      structure: "Poteaux & platines/scellement",
      revetement: "Travées & lames/panneaux",
      unitePrincipale: "ml",
    },
  },
};

export interface MateriauSuivi {
  nom: string;
  statut: "ok" | "vigilance" | "alerte";
  detail: string;
}

export interface AvancementDetail {
  label: string;
  pourcentage: number;
}

export interface Chantier {
  id: string;
  client_id?: string;
  client_nom?: string;
  nom: string;
  ville: string;
  adresse?: string;
  adresse_complement?: string;
  code_postal?: string;
  date_debut_prevue?: string;
  date_fin_prevue?: string;
  contact_id?: string;
  telephoneContact?: string;
  telephoneClient?: string;
  metier: MetierType;
  intervention: string;
  avancementGlobal: number;
  avancementDetails: AvancementDetail[];
  prochaineEtape: {
    titre: string;
    detail: string;
  };
  meteoImpact: {
    alerte: string;
    consignes: string[];
  };
  materiaux: MateriauSuivi[];
  blocage?: {
    titre: string;
    detail: string;
  };
  photosRecentesCount: number;
  deleted_at?: string | null;
}
