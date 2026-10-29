import { Chantier } from "@/types/metier";

export const MOCK_CHANTIERS: Record<string, Chantier> = {
  martin: {
    id: "martin",
    nom: "Terrasse Martin",
    ville: "Mérignac",
    metier: "terrasse",
    intervention: "Pose des lames en cours",
    avancementGlobal: 65,
    avancementDetails: [
      { label: "Structure lambourdes & plots", pourcentage: 100 },
      { label: "Platelage lames & clips", pourcentage: 40 },
    ],
    prochaineEtape: {
      titre: "Fixation des bandeaux de finition",
      detail: "Programmé pour demain matin dès 08h30.",
    },
    meteoImpact: {
      alerte: "Pluie à 14 h : interruption pose extérieure",
      consignes: [
        "Bâchage obligatoire de la structure avant 13h30",
        "Repli des outils électroportatifs sous le préau",
      ],
    },
    materiaux: [
      { nom: "Vis Inox A4 5x50", statut: "vigilance", detail: "Stock juste (reste 1 boîte)" },
      { nom: "Lames Cumaru 145mm", statut: "ok", detail: "Stock complet sur site" },
    ],
    blocage: {
      titre: "Attente validation cornière d'angle",
      detail: "Client à relancer pour validation couleur aluminium.",
    },
    photosRecentesCount: 3,
  },
  dupont: {
    id: "dupont",
    nom: "Bardage Dupont",
    ville: "Pessac",
    metier: "facade",
    intervention: "Pose ossature bois & pare-pluie",
    avancementGlobal: 40,
    avancementDetails: [
      { label: "Ossature secondaire & équerres", pourcentage: 80 },
      { label: "Pare-pluie & liteaux de ventilation", pourcentage: 45 },
      { label: "Panneaux / Lames de bardage", pourcentage: 0 },
    ],
    prochaineEtape: {
      titre: "Contrôle planéité et pose du pare-pluie",
      detail: "Validation de la ventilation haute et basse.",
    },
    meteoImpact: {
      alerte: "Vent fort à 15 h : prise au vent des panneaux",
      consignes: [
        "Arrêt manutention grandes plaques",
        "Arrimage des bâches d'échafaudage",
      ],
    },
    materiaux: [
      { nom: "Grilles anti-rongeurs", statut: "vigilance", detail: "Manque 4 mètres linéaires" },
      { nom: "Vis d'ossature 6x100", statut: "ok", detail: "Stock suffisant" },
    ],
    blocage: {
      titre: "Réservation gaine VMC non percée",
      detail: "Attente intervention électricien en façade.",
    },
    photosRecentesCount: 5,
  },
  bernard: {
    id: "bernard",
    nom: "Clôture Bernard",
    ville: "Talence",
    metier: "cloture",
    intervention: "Scellement des poteaux et pose travées",
    avancementGlobal: 55,
    avancementDetails: [
      { label: "Scellement poteaux / platines", pourcentage: 90 },
      { label: "Pose lames composites & entretoises", pourcentage: 25 },
    ],
    prochaineEtape: {
      titre: "Emboîtement des lames de la travée 4 à 8",
      detail: "Vérification des niveaux et jeux de dilatation.",
    },
    meteoImpact: {
      alerte: "Averses passagères en milieu de journée",
      consignes: [
        "Protéger le béton frais des poteaux fraîchement coulés",
      ],
    },
    materiaux: [
      { nom: "Chapeaux de poteaux alu", statut: "ok", detail: "Lot complet réceptionné" },
      { nom: "Platines de fixation sol", statut: "ok", detail: "Toutes ancrées" },
    ],
    photosRecentesCount: 2,
  },
};
