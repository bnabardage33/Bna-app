import unittest
from engine import CalepinageTerrasseInput, calculer_calepinage_terrasse

class TestCalepinage(unittest.TestCase):
    def test_calcul_terrasse_standard(self):
        # Terrasse de 6m x 4m (24 m²)
        params = CalepinageTerrasseInput(
            longueur_m=6.0,
            largeur_m=4.0,
            largeur_lame_mm=140.0,
            longueur_lame_m=3.0,
            espace_inter_lames_mm=5.0,
            entraxe_lambourdes_cm=40.0,
            marge_chutes_pct=10.0
        )
        res = calculer_calepinage_terrasse(params)
        
        self.assertEqual(res.surface_nette_m2, 24.0)
        self.assertGreater(res.nb_lames_avec_marge, res.nb_lames_theorique)
        self.assertGreater(res.ml_lambourdes_total, 0)
        self.assertGreater(res.nb_plots_necessaires, 0)
        self.assertGreater(res.nb_vis_inox, 0)
        print("\n=== Test Calepinage Déterministe Réussi ===")
        print(f"Surface: {res.surface_nette_m2} m²")
        print(f"Lames nécessaires (avec marge 10%): {res.nb_lames_avec_marge} lames de 3m")
        print(f"Lambourdes (3m): {res.nb_lambourdes_3m}")
        print(f"Plots réglables: {res.nb_plots_necessaires}")
        print(f"Vis inox: {res.nb_vis_inox}")

if __name__ == "__main__":
    unittest.main()
