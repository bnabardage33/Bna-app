# BNA-APP — Documentation de l'Assistant IA Central & des Modules Métier (3 Étapes)

Ce document récapitule l'architecture et l'ensemble des fonctionnalités déployées dans **Bna-app** au cours des **3 étapes d'intégration** issues de la convergence entre `bna-dashboard` et `Bna-app`.

---

## Architecture Globale & Flux de Données

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BNA ASSISTANT IA CENTRAL (Gaël — Gérant)             │
│  • Dictée vocale terrain (fr-FR) & Chat naturel                         │
│  • Moteur Expert DTU (51.4, 41.2, 45.4, P98-405) + Hybride LLM (Gemini) │
│  • Cartes d'Action Interactives (Tool Calling avec confirmation)        │
└───────────────┬─────────────────────────┬───────────────────────┬───────┘
                │                         │                       │
                ▼                         ▼                       ▼
┌───────────────────────────┐ ┌─────────────────────────┐ ┌───────────────────────┐
│ ÉTAPE 1 : OPÉRATIONS & DTU│ │ ÉTAPE 2 : DEVIS & MARGES│ │ ÉTAPE 3 : PV & SAV    │
│ • Chantiers actifs        │ │ • Devis Multi-TVA       │ │ • PV Réception 1792-6 │
│ • Planning & RDVs         │ │ • Import Calepinage 1-c │ │ • Levée des réserves  │
│ • Météo & Faisabilité DTU │ │ • Factures & Situations │ │ • Retenue 5% libérable│
│ • Commandes fournisseurs  │ │ • Retenue 5% Loi 71-584 │ │ • Fiches SAV Décennale│
└───────────────────────────┘ └─────────────────────────┘ └───────────────────────┘
```

---

## ÉTAPE 1 : Assistant IA Central BNA (Copilote Opérationnel & Réglementaire)

### Fichiers clés
- `src/lib/services/bnaAssistantService.ts` — Moteur de contexte, base réglementaire DTU, parseur de dates/heures naturelles et détecteur d'intentions (Tool Calling).
- `src/app/api/assistant/route.ts` — Moteur de Routage Hybride Intelligent :
  - **100% Local par défaut** (0ms de latence, 0 coût d'API, 0 données transmises à l'extérieur) pour toutes les actions quotidiennes (création RDVs, avancement chantiers, météo DTU, chiffrage rapide, bilan trésorerie, suivi des réserves & SAV).
  - **Bascule automatique sur Mistral AI** (`MISTRAL_API_KEY`, Cloud Français souverain sous RGPD avec garantie contractuelle de non-réutilisation des données) ou Gemini/Groq pour les études techniques approfondies (ex : calcul complexe de calepinage 6×4,50m avec double lambourdage, DTU 51.4 et dilatation) ou la conversation libre.
- `src/components/screens/AssistantScreen.tsx` — Interface Cockpit conversationnelle accessible depuis l'onglet **Assistant**.

### Fonctionnalités principales
1. **Conscience du Contexte Temps Réel** :
   - Reconnaissance automatique de l'utilisateur (**Gaël — Gérant**).
   - Injection en direct des **chantiers actifs**, de leur **avancement (%)**, des **rendez-vous planifiés**, des **commandes fournisseurs** et des **alertes météo**.
   - Sélecteur de contexte permettant de cibler tous les chantiers ou un chantier précis (*Terrasse Martin*, *Bardage Dupont*, *Clôture Bernard*, etc.).
2. **Base de Connaissances Certifiée DTU** :
   - **NF DTU 51.4 (Terrasses bois & composites)** : entraxes lambourdes (40–50 cm), double appui d'aboutage, bande bitumineuse EPDM, ventilation sous platelage (50 mm min.), jeux inter-lames (5–8 mm) et périphériques (10–15 mm), visserie Inox A2/A4.
   - **NF DTU 41.2 (Bardage bois)** : lame d'air ventilée (20 mm min.), grilles anti-rongeurs haute/basse (50 cm²/ml), garde au sol (20 cm / 15 cm), taux d'humidité du bois (13%–18%), pare-pluie HPV ($S_d \le 0,18\text{ m}$).
   - **NF DTU 45.4 (Bardage HPL Polyrey / Trespa)** : principe Point Fixe central / Points Coulissants (perçage 8–10 mm), jeu périphérique de dilatation (8–10 mm), bande EPDM sur montants.
   - **NF P98-405 (Clôtures)** : dimensionnement des fouilles béton (50–60 cm) et résistance à la prise au vent en cas d'occultation.
3. **Analyse Météo & Sécurité de Pose DTU** :
   - Croisement des conditions météo du chantier avec les seuils d'arrêt de pose DTU (pluie battante, vent fort $> 50\text{ km/h}$, humidité du bois).
   - Qualification automatique : `✅ POSE FAVORABLE`, `⚠️ VIGILANCE POSE`, ou `🛑 POSE DÉCONSEILLÉE`.
4. **Dictée Vocale Terrain & Cartes d'Action (Tool Calling)** :
   - Bouton **Microphone (`fr-FR`)** pour dicter ses instructions sur chantier.
   - **Cartes d'Action soumises à validation** :
     - `create_rdv` : *"Planifie un RDV demain à 9h30 sur Terrasse Martin pour contrôle lambourdes"* ➔ Crée le RDV dans le Planning Général.
     - `update_avancement` : *"Passe l'avancement de Terrasse Martin à 85%"* ➔ Met à jour la jauge d'avancement du chantier.
     - `open_calepinage` / `open_cockpit` : Ouvre directement le moteur de calepinage 2D/3D ou le cockpit du chantier.

---

## ÉTAPE 2 : Module Devis, Factures, Situations & Rentabilité Chantiers

### Fichiers clés
- `src/lib/services/devisFinanceService.ts` — Moteur de calcul financier au centime près, gestion Multi-TVA, Retenue de Garantie 5% et passerelle Calepinage ➔ Devis.
- `src/components/screens/DevisFinanceScreen.tsx` — Écran complet accessible depuis l'onglet **Devis**.

### Fonctionnalités principales
1. **Bandeau de Pilotage Trésorerie (4 KPIs en direct)** :
   - **CA Signé HT** + Pipeline des devis en attente de signature.
   - **Encaissé TTC** + Reste à facturer HT sur les chantiers signés.
   - **Marge Brute Signée (€ et %)** avec contrôle du seuil de rentabilité BNA ($\ge 30\%$).
   - **À Encaisser / Relances** (détection automatique des factures en retard d'échéance) + cumul des retenues de garantie bloquées.
2. **Devis & Chiffrage Commercial Multi-TVA** :
   - Séparation explicite entre **Coût Matériaux HT** (`type_cout: "matiere"`) et **Coût Main d'Œuvre HT** (`type_cout: "main_oeuvre"`) pour calculer la **Marge Brute réelle** de chaque devis.
   - Support des taux de TVA BTP : **10%** (rénovation $> 2\text{ ans}$), **20%** (neuf / clôture), **5,5%** (ITE / isolation), **0%** (autoliquidation).
   - **Passerelle 1-clic Calepinage ➔ Devis** : importe automatiquement les besoins matériaux calculés par les moteurs de Calepinage (Terrasse, Bardage, Clôture) et ajoute la ligne de main d'œuvre de pose correspondante.
3. **Factures d'Acompte, Situations d'Avancement & Retenue de Garantie (Loi n° 71-584)** :
   - Génération en **1 clic** depuis n'importe quel devis :
     - **Facture d'Acompte (30%)**
     - **Facture de Situation d'Avancement (%)** calée sur l'avancement physique du chantier
     - **Facture de Solde**
   - Calcul automatique de la **Retenue de Garantie légale (plafonnée à 5% — Loi n° 71-584)** et du **Net à payer TTC**.
   - Pointage **"Payée"** en 1 clic, relance client sur les factures échues, et **Aperçu PDF / Impression Pro BNA**.
4. **Tableau Analytique des Marges par Chantier** :
   - Vue comparative par chantier : *Prix de Vente HT* vs *Coût Matériaux HT* + *Coût Main d'Œuvre HT* vs *Avancement physique* et *Déjà facturé / encaissé*.
5. **Connexion à l'Assistant IA** :
   - Question : *"Quel est mon chiffre d'affaires, ma trésorerie et mes factures en retard ?"* ➔ Bilan financier instantané + alerte sur les factures échues.
   - Action IA (`create_devis`) : *"Crée un devis pour Terrasse Martin de 45 m²"* ➔ Génère une carte d'action qui crée le devis chiffré en 1 clic.

---

## ÉTAPE 3 : Procès-Verbaux de Réception (Art. 1792-6), Réserves & SAV Décennale

### Fichiers clés
- `src/lib/services/pvSavService.ts` — Gestion des PV de réception, suivi et levée des réserves, libération de la retenue de garantie 5% et tickets SAV / Garantie Décennale.
- `src/components/chantiers/PvReceptionSavModal.tsx` — Interface disponible à la fois dans l'onglet **Devis > PV Réception & SAV** (vue globale) et dans le **Cockpit de chaque chantier** (vue dédiée au chantier).

### Fonctionnalités principales
1. **Procès-Verbaux de Réception de Travaux (Art. 1792-6 du Code Civil & NF P 03-001)** :
   - 4 statuts officiels :
     - `Réception Sans Réserve`
     - `Réception Avec Réserves`
     - `Réserves Intégralement Levées`
     - `Refus de Réception`
   - **Checklist de repli de chantier** (nettoyage du site, évacuation des déchets, démontage échafaudage, remise des fiches techniques et du guide d'entretien annuel).
   - **Déclenchement formel des 3 garanties légales** à la date du PV :
     - **GPA (Garantie de Parfait Achèvement — 1 an)**
     - **Garantie Biennale (2 ans)**
     - **Garantie Décennale (10 ans — Art. 1792)**
2. **Gestion Interactive des Réserves & Libération de la Retenue de Garantie 5%** :
   - Ajout de réserves avec localisation et date limite de reprise.
   - **Pointage en 1 clic de la levée d'une réserve** : lorsque toutes les réserves d'un PV sont cochées comme levées, le statut du PV passe automatiquement à **`Réserves Intégralement Levées`**.
   - **Bouton de déblocage de la Retenue de Garantie 5% (Loi 71-584)** : activé dès que le PV est sans réserve ou que toutes les réserves sont levées.
3. **Fiches d'Intervention SAV & Diagnostic Réglementaire DTU** :
   - Qualification du cadre de garantie (*GPA 1 an*, *Biennale 2 ans*, *Décennale 10 ans*, *Hors garantie*).
   - **Diagnostic DTU intégré** attestant de la conformité de la pose initiale (NF DTU 51.4 / 41.2 / 45.4) et détaillant les travaux de reprise.
   - Aperçus officiels imprimables / PDF pour le **PV de Réception** et le **Rapport d'Intervention SAV**.
4. **Connexion à l'Assistant IA** :
   - Bouton rapide **"🛡️ PV Réception & SAV"** dans l'Assistant IA.
   - Question : *"Quelles sont les réserves à lever sur mes PV de réception et mes interventions SAV ?"* ➔ L'IA liste chaque réserve non levée avec son échéance ainsi que les interventions SAV programmées.

---

## Architecture Hybride & Confidentialité des Données (Local vs Groq Cloud)

Afin de concilier **confidentialité totale des données chantiers**, **zéro coût** et **puissance de calcul sur les cas complexes**, l'API `/api/assistant` applique une règle de **routage hybride intelligent** :

| Type de demande | Traitement | Envoi externe | Vitesse | Clé requise |
|---|---|---|---|---|
| **Gestion quotidienne** (RDV, % avancement, météo chantier, liste PV/SAV, trésorerie) | **🟢 Moteur Local BNA** | **Aucun (0 octet)** | Instantané (1 ms) | Aucune |
| **Règles DTU standard** (entraxe 51.4, fixations 41.2, garde au sol) | **🟢 Moteur Local BNA** | **Aucun (0 octet)** | Instantané (1 ms) | Aucune |
| **Étude technique complexe** (ex: terrasse composite 6×4,5m avec découpes, entraxes fabricants, calcul de pertes) | **🚀 Groq Cloud (GPT-OSS / Qwen)** | Uniquement la question technique | ~1 seconde | `GROQ_API_KEY` |
| **Conversation libre & Politesse** ("ça va ?", "raconte-moi...") | **🚀 Groq Cloud (GPT-OSS / Qwen)** | Uniquement le message | ~0,5 seconde | `GROQ_API_KEY` |

### Modèles supportés sur Groq (100% Gratuits) :
L'application essaie par défaut le modèle le plus puissant et bascule automatiquement sur les suivants en cas de forte charge :
1. **`openai/gpt-oss-120b`** (OpenAI GPT-OSS 120B — Modèle de raisonnement phare 120 milliards de paramètres, 500 tokens/sec) — **Activé par défaut**
2. **`qwen/qwen3.8-27b`** (Qwen 3.8 27B — Modèle avancé de raisonnement Alibaba, analyse technique pointue)
3. **`openai/gpt-oss-20b`** (OpenAI GPT-OSS 20B — Modèle ultra-rapide à 1 000 tokens/sec)

### Configuration sur Vercel :
Dans le tableau de bord Vercel de `Bna-app` > **Settings** > **Environment Variables** :
- **Variable** : `GROQ_API_KEY`
- **Valeur** : votre clé obtenue gratuitement sur [console.groq.com](https://console.groq.com)
- *(Optionnel)* **Variable** : `GROQ_MODEL` si vous souhaitez forcer un modèle spécifique (ex: `qwen/qwen3.8-27b` ou `openai/gpt-oss-20b`). Par défaut : `openai/gpt-oss-120b`.

---

## Vérification & Tests Automatisés

L'ensemble des moteurs métiers et de l'Assistant IA est couvert par une suite de **35 assertions unitaires** exécutables à tout moment via :

```bash
node --experimental-strip-types src/lib/services/bnaAssistant.test.ts
npx tsc --noEmit
```
