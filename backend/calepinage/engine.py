"""
Moteur de calcul déterministe pour le calepinage terrasse bois / composite.
Respecte les règles professionnelles (entraxes DTU 51.4, chutes, fixation).
"""

from dataclasses import dataclass
from typing import Dict, Any
import math

@dataclass
class CalepinageTerrasseInput:
    longueur_m: float          # Longueur terrasse en mètres
    largeur_m: float           # Largeur terrasse en mètres
    largeur_lame_mm: float     # Largeur de la lame en mm (ex: 145)
    longueur_lame_m: float     # Longueur standard de la lame en mètres (ex: 3.0 ou 4.0)
    espace_inter_lames_mm: float = 5.0  # Jeu entre lames (mm)
    entraxe_lambourdes_cm: float = 40.0 # Entraxe lambourdes (cm, standard DTU: 40-50 cm)
    hauteur_plot_min_mm: float = 40.0
    espace_entre_plots_cm: float = 50.0 # Espacement des plots le long de la lambourde (cm)
    marge_chutes_pct: float = 10.0      # Marge pour chutes et découpes (%)

@dataclass
class CalepinageTerrasseResult:
    surface_nette_m2: float
    nb_lames_theorique: int
    nb_lames_avec_marge: int
    ml_lames_total: float
    nb_rangees: int
    ml_lambourdes_total: float
    nb_lambourdes_3m: int
    nb_plots_necessaires: int
    nb_vis_inox: int
    details: Dict[str, Any]

def calculer_calepinage_terrasse(data: CalepinageTerrasseInput) -> CalepinageTerrasseResult:
    """
    Calcul 100% déterministe et reproductible des quantités de matériaux.
    """
    surface_m2 = round(data.longueur_m * data.largeur_m, 2)
    
    # Largeur utile d'une rangée (largeur lame + joint de dilatation)
    largeur_utile_lame_m = (data.largeur_lame_mm + data.espace_inter_lames_mm) / 1000.0
    
    # Nombre de rangées dans la largeur
    nb_rangees = math.ceil(data.largeur_m / largeur_utile_lame_m)
    
    # Mètres linéaires de lames nécessaires
    ml_lames_brut = nb_rangees * data.longueur_m
    marge_facteur = 1.0 + (data.marge_chutes_pct / 100.0)
    ml_lames_total = round(ml_lames_brut * marge_facteur, 2)
    
    # Nombre de lames physiques
    nb_lames_theorique = math.ceil(ml_lames_brut / data.longueur_lame_m)
    nb_lames_avec_marge = math.ceil(ml_lames_total / data.longueur_lame_m)
    
    # Lambourdes (posées perpendiculairement aux lames)
    entraxe_m = data.entraxe_lambourdes_cm / 100.0
    nb_lignes_lambourdes = math.ceil(data.longueur_m / entraxe_m) + 1
    ml_lambourdes_brut = nb_lignes_lambourdes * data.largeur_m
    ml_lambourdes_total = round(ml_lambourdes_brut * 1.07, 2) # 7% marge lambourdes
    nb_lambourdes_3m = math.ceil(ml_lambourdes_total / 3.0)
    
    # Plots réglables
    espace_plots_m = data.espace_entre_plots_cm / 100.0
    plots_par_ligne = math.ceil(data.largeur_m / espace_plots_m) + 1
    nb_plots = nb_lignes_lambourdes * plots_par_ligne
    
    # Vis inox (2 vis par intersection lame/lambourde)
    intersections_par_rangee = nb_lignes_lambourdes
    nb_vis = nb_rangees * intersections_par_rangee * 2
    # Sécurité boîte (arrondi au paquet de 100 ou 200)
    nb_vis_paquet = math.ceil((nb_vis * 1.05) / 100) * 100

    return CalepinageTerrasseResult(
        surface_nette_m2=surface_m2,
        nb_lames_theorique=nb_lames_theorique,
        nb_lames_avec_marge=nb_lames_avec_marge,
        ml_lames_total=ml_lames_total,
        nb_rangees=nb_rangees,
        ml_lambourdes_total=ml_lambourdes_total,
        nb_lambourdes_3m=nb_lambourdes_3m,
        nb_plots_necessaires=nb_plots,
        nb_vis_inox=nb_vis_paquet,
        details={
            "entraxe_lambourdes_cm": data.entraxe_lambourdes_cm,
            "joint_inter_lames_mm": data.espace_inter_lames_mm,
            "marge_appliquee_pct": data.marge_chutes_pct,
        }
    )
