from flask import Flask, request, jsonify
from calepinage.engine import CalepinageTerrasseInput, calculer_calepinage_terrasse

app = Flask(__name__)

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "bna-backend-python", "version": "1.0.0"})

@app.route("/api/calepinage/terrasse", methods=["POST"])
def api_calepinage():
    data = request.get_json() or {}
    try:
        params = CalepinageTerrasseInput(
            longueur_m=float(data.get("longueur_m", 5.0)),
            largeur_m=float(data.get("largeur_m", 3.5)),
            largeur_lame_mm=float(data.get("largeur_lame_mm", 145.0)),
            longueur_lame_m=float(data.get("longueur_lame_m", 3.0)),
            espace_inter_lames_mm=float(data.get("espace_inter_lames_mm", 5.0)),
            entraxe_lambourdes_cm=float(data.get("entraxe_lambourdes_cm", 40.0)),
            hauteur_plot_min_mm=float(data.get("hauteur_plot_min_mm", 40.0)),
            espace_entre_plots_cm=float(data.get("espace_entre_plots_cm", 50.0)),
            marge_chutes_pct=float(data.get("marge_chutes_pct", 10.0))
        )
        result = calculer_calepinage_terrasse(params)
        return jsonify({
            "success": True,
            "data": {
                "surface_nette_m2": result.surface_nette_m2,
                "nb_lames_theorique": result.nb_lames_theorique,
                "nb_lames_avec_marge": result.nb_lames_avec_marge,
                "ml_lames_total": result.ml_lames_total,
                "nb_rangees": result.nb_rangees,
                "ml_lambourdes_total": result.ml_lambourdes_total,
                "nb_lambourdes_3m": result.nb_lambourdes_3m,
                "nb_plots_necessaires": result.nb_plots_necessaires,
                "nb_vis_inox": result.nb_vis_inox,
                "details": result.details
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

if __name__ == "__main__":
    print("BNA Python Backend démarré sur http://127.0.0.1:8000")
    app.run(host="127.0.0.1", port=8000, debug=False)
