/**
 * BNA-APP — Tests Fonctionnels & Métier : Module Commandes Fournisseurs V1
 *
 * Vérification des règles :
 * 1. Numérotation atomique humaine CMD-YYYY-XXXX (zéro collision)
 * 2. Snapshot immuable des besoins (V3 figée même si V4 créée ensuite)
 * 3. Répertoire Fournisseurs (Point P, Chausson...)
 * 4. Préparation commandes partielles (lames chez l'un, plots chez l'autre)
 * 5. Modification manuelle des quantités autorisée uniquement en brouillon
 * 6. Cycle des statuts V1 (brouillon, envoyee, commandee, annulee)
 * 7. Isolation RLS Multi-Tenant
 * 8. Mémorisation de la version source (ex: V3)
 */

import {
  creerCommandeFournisseur,
  creerFournisseur,
  getFournisseurs,
  getCommandesByChantier,
  getCommandeDetail,
  updateLignesCommande,
  changerStatutCommande,
} from "./commandesFournisseursService.ts";
import type {
  FournisseurRow,
  CommandeFournisseurRow,
  LigneCommandeFournisseurRow,
  StatutCommandeFournisseur,
} from "./commandesFournisseursService.ts";

let passed = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`✓ PASS: ${msg}`);
}

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Mock Supabase Database avec émulation de la RPC creer_commande_fournisseur
// et des politiques RLS de la migration 009.
// ---------------------------------------------------------------------------
type DbState = {
  entreprises: { id: string; nom: string }[];
  profils: { id: string; entreprise_id: string }[];
  chantiers: { id: string; entreprise_id: string; nom: string }[];
  calepinages: { id: string; entreprise_id: string; chantier_id: string; version: number }[];
  besoins_materiaux: {
    id: string;
    entreprise_id: string;
    chantier_id: string;
    calepinage_id: string | null;
    designation: string;
    categorie: string;
    unite: string;
    quantite: number;
    statut: string;
  }[];
  fournisseurs: FournisseurRow[];
  compteurs_numerotation: {
    entreprise_id: string;
    type_document: string;
    annee: number;
    dernier_numero: number;
  }[];
  commandes_fournisseurs: CommandeFournisseurRow[];
  lignes_commande_fournisseur: LigneCommandeFournisseurRow[];
};

function createMockSupabase(db: DbState, sessionEntrepriseId: string | null) {
  let seqId = 1;

  const client: any = {
    auth: {
      getUser: async () => ({
        data: { user: sessionEntrepriseId ? { id: `user-${sessionEntrepriseId}` } : null },
      }),
    },
    rpc: async (name: string, args: any) => {
      if (name !== "creer_commande_fournisseur") {
        return { data: null, error: new Error("RPC inconnue") };
      }
      if (!sessionEntrepriseId) {
        return { data: null, error: new Error("Utilisateur non authentifié ou non rattaché à une entreprise") };
      }
      if (!args.p_chantier_id) {
        return { data: null, error: new Error("Chantier obligatoire") };
      }
      const chantier = db.chantiers.find(
        (c) => c.id === args.p_chantier_id && c.entreprise_id === sessionEntrepriseId
      );
      if (!chantier) {
        return { data: null, error: new Error("Chantier introuvable ou non autorisé") };
      }

      const fournisseur = db.fournisseurs.find(
        (f) => f.id === args.p_fournisseur_id && f.entreprise_id === sessionEntrepriseId
      );
      if (!fournisseur) {
        return { data: null, error: new Error("Fournisseur introuvable ou non autorisé") };
      }

      if (!Array.isArray(args.p_lignes) || args.p_lignes.length === 0) {
        return { data: null, error: new Error("La commande doit comporter au moins une ligne") };
      }

      // Résolution version source
      let versionNumero: number | null = null;
      if (args.p_version_source_id) {
        const cal = db.calepinages.find(
          (c) => c.id === args.p_version_source_id && c.entreprise_id === sessionEntrepriseId
        );
        if (cal) versionNumero = cal.version;
      }

      // Génération atomique numéro séquentiel
      const annee = new Date().getFullYear();
      let compteur = db.compteurs_numerotation.find(
        (cp) => cp.entreprise_id === sessionEntrepriseId && cp.type_document === "commande_fournisseur" && cp.annee === annee
      );
      if (!compteur) {
        compteur = {
          entreprise_id: sessionEntrepriseId,
          type_document: "commande_fournisseur",
          annee,
          dernier_numero: 1,
        };
        db.compteurs_numerotation.push(compteur);
      } else {
        compteur.dernier_numero += 1;
      }

      const numStr = String(compteur.dernier_numero).padStart(4, "0");
      const numeroCommande = `CMD-${annee}-${numStr}`;

      const cmdId = `cmd-${seqId++}`;
      const nouvelleCommande: CommandeFournisseurRow = {
        id: cmdId,
        entreprise_id: sessionEntrepriseId,
        chantier_id: args.p_chantier_id,
        fournisseur_id: args.p_fournisseur_id,
        version_source_id: args.p_version_source_id || null,
        version_source_numero: versionNumero,
        numero_commande: numeroCommande,
        statut: "brouillon",
        date_commande: new Date().toISOString(),
        commentaire: args.p_commentaire || null,
        reference_fournisseur: args.p_reference_fournisseur || null,
        date_livraison_souhaitee: args.p_date_livraison_souhaitee || null,
        piece_jointe_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.commandes_fournisseurs.push(nouvelleCommande);

      const lignesCreees: LigneCommandeFournisseurRow[] = [];
      for (const l of args.p_lignes) {
        if (!l.designation || !l.designation.trim()) {
          return { data: null, error: new Error("Désignation obligatoire") };
        }
        if (typeof l.quantite !== "number" || l.quantite < 0) {
          return { data: null, error: new Error(`Quantité invalide pour ${l.designation}`) };
        }
        const lig: LigneCommandeFournisseurRow = {
          id: `lig-${seqId++}`,
          commande_id: cmdId,
          besoin_source_id: l.besoin_source_id || null,
          designation: l.designation.trim(),
          categorie: l.categorie || "autre",
          unite: l.unite || "u",
          quantite: l.quantite,
          created_at: new Date().toISOString(),
        };
        db.lignes_commande_fournisseur.push(lig);
        lignesCreees.push(lig);
      }

      return {
        data: {
          commande: nouvelleCommande,
          lignes: lignesCreees,
        },
        error: null,
      };
    },
    from: (table: string) => {
      let rows = [...((db as any)[table] || [])];
      // Filtrage RLS par entreprise
      if (sessionEntrepriseId) {
        if (table === "lignes_commande_fournisseur") {
          const mesCmds = db.commandes_fournisseurs
            .filter((c) => c.entreprise_id === sessionEntrepriseId)
            .map((c) => c.id);
          rows = rows.filter((r) => mesCmds.includes(r.commande_id));
        } else if (table !== "profils") {
          rows = rows.filter((r) => r.entreprise_id === sessionEntrepriseId);
        }
      } else {
        rows = [];
      }

      const query: any = {
        select: (_cols?: string) => query,
        eq: (col: string, val: any) => {
          rows = rows.filter((r) => r[col] === val);
          return query;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          const asc = opts?.ascending ?? true;
          rows.sort((a, b) => (asc ? (a[col] > b[col] ? 1 : -1) : (a[col] < b[col] ? 1 : -1)));
          return query;
        },
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        single: async () => ({
          data: rows[0] || null,
          error: rows[0] ? null : new Error("Introuvable"),
        }),
        insert: (val: any) => {
          let err: any = null;
          let item: any = null;
          if (!sessionEntrepriseId) {
            err = new Error("Non authentifié");
          } else if (table === "fournisseurs") {
            const exists = db.fournisseurs.some(
              (f) => f.entreprise_id === sessionEntrepriseId && f.nom.toLowerCase() === val.nom.toLowerCase()
            );
            if (exists) {
              err = { code: "23505", message: "Doublon nom fournisseur" };
            }
          }

          if (!err) {
            item = { id: `item-${seqId++}`, ...val, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            (db as any)[table].push(item);
          }

          const insertRes: any = {
            select: () => ({
              single: async () => ({ data: item, error: err }),
              maybeSingle: async () => ({ data: item, error: err }),
              then: (resolve: any) => Promise.resolve({ data: item ? [item] : null, error: err }).then(resolve),
            }),
            data: item,
            error: err,
            then: (resolve: any) => Promise.resolve({ data: item, error: err }).then(resolve),
          };
          return insertRes;
        },
        update: (val: any) => {
          return {
            eq: (col: string, v: any) => {
              const subQuery: any = {
                eq: async (col2: string, v2: any) => {
                  rows.forEach((r) => {
                    if (r[col] === v && r[col2] === v2) Object.assign(r, val);
                  });
                  return { error: null };
                },
                then: (res: any) => {
                  rows.forEach((r) => {
                    if (r[col] === v) Object.assign(r, val);
                  });
                  return Promise.resolve({ error: null }).then(res);
                },
              };
              return subQuery;
            },
          };
        },
        then: (resolve: any) => {
          // Si jointure fournisseur:fournisseurs(*)
          const enriched = rows.map((r) => {
            if (table === "commandes_fournisseurs") {
              const f = db.fournisseurs.find((fn) => fn.id === r.fournisseur_id);
              return { ...r, fournisseur: f || null };
            }
            return r;
          });
          return Promise.resolve({ data: enriched, error: null }).then(resolve);
        },
      };
      return query;
    },
  };

  return client;
}

async function runTests() {
  console.log("=== TESTS MODULE COMMANDES FOURNISSEURS V1 ===");

  const db: DbState = {
    entreprises: [
      { id: "ent-A", nom: "Menuiserie Aquitaine" },
      { id: "ent-B", nom: "Terrasses Méditerranée" },
    ],
    profils: [
      { id: "user-ent-A", entreprise_id: "ent-A" },
      { id: "user-ent-B", entreprise_id: "ent-B" },
    ],
    chantiers: [
      { id: "ch-1", entreprise_id: "ent-A", nom: "Terrasse Mérignac" },
      { id: "ch-B1", entreprise_id: "ent-B", nom: "Piscine Nice" },
    ],
    calepinages: [
      { id: "cal-v1", entreprise_id: "ent-A", chantier_id: "ch-1", version: 1 },
      { id: "cal-v2", entreprise_id: "ent-A", chantier_id: "ch-1", version: 2 },
      { id: "cal-v3", entreprise_id: "ent-A", chantier_id: "ch-1", version: 3 },
    ],
    besoins_materiaux: [
      // Besoins actifs V3 (Terrasse 6x4m + 3x2m)
      { id: "bes-1", entreprise_id: "ent-A", chantier_id: "ch-1", calepinage_id: "cal-v3", categorie: "lames", designation: "Lames Pin traité 3,00 m", unite: "lames", quantite: 82, statut: "a_commander" },
      { id: "bes-2", entreprise_id: "ent-A", chantier_id: "ch-1", calepinage_id: "cal-v3", categorie: "lambourdes", designation: "Lambourdes pin 3,00 m", unite: "barres", quantite: 32, statut: "a_commander" },
      { id: "bes-3", entreprise_id: "ent-A", chantier_id: "ch-1", calepinage_id: "cal-v3", categorie: "plots", designation: "Plots réglables 40-60 mm", unite: "plots", quantite: 209, statut: "a_commander" },
      { id: "bes-4", entreprise_id: "ent-A", chantier_id: "ch-1", calepinage_id: "cal-v3", categorie: "fixations", designation: "Vis inox A2 (boîte de 200)", unite: "vis", quantite: 1400, statut: "a_commander" },
    ],
    fournisseurs: [],
    compteurs_numerotation: [],
    commandes_fournisseurs: [],
    lignes_commande_fournisseur: [],
  };

  const sbA = createMockSupabase(db, "ent-A");
  const sbB = createMockSupabase(db, "ent-B");
  const sbAnon = createMockSupabase(db, null);

  // =========================================================================
  // 1. GESTION DES FOURNISSEURS (Point P, Chausson...)
  // =========================================================================
  const fPointP = await creerFournisseur(sbA, {
    nom: "Point P Mérignac",
    telephone: "05 56 00 00 00",
    email: "contact@pointp.fr",
    notes: "Négociant bois principal",
  });
  assert(Boolean(fPointP.id) && fPointP.nom === "Point P Mérignac", "1.A: Fournisseur Point P créé");

  const fChausson = await creerFournisseur(sbA, {
    nom: "Chausson Matériaux",
    telephone: "05 56 11 22 33",
  });
  assert(Boolean(fChausson.id) && fChausson.nom === "Chausson Matériaux", "1.B: Fournisseur Chausson créé");

  const fournisseursList = await getFournisseurs(sbA);
  assert(fournisseursList.length === 2, "1.C: Liste des fournisseurs retourne 2 fournisseurs");

  // Doublon refusé
  const errDoublon = await sbA.from("fournisseurs").insert({ nom: "Point P Mérignac" });
  assert(errDoublon.error?.code === "23505", "1.D: Doublon de nom de fournisseur refusé au niveau entreprise");

  // =========================================================================
  // 2. CRÉATION COMMANDE & NUMÉROTATION ATOMIQUE CMD-YYYY-XXXX
  // =========================================================================
  const annee = new Date().getFullYear();
  const resCmd1 = await creerCommandeFournisseur(sbA, {
    chantier_id: "ch-1",
    fournisseur_id: fPointP.id,
    version_source_id: "cal-v3",
    commentaire: "Livraison mardi matin sur chantier",
    lignes: [
      { besoin_source_id: "bes-1", designation: "Lames Pin traité 3,00 m", categorie: "lames", unite: "lames", quantite: 82 },
      { besoin_source_id: "bes-2", designation: "Lambourdes pin 3,00 m", categorie: "lambourdes", unite: "barres", quantite: 32 },
      { besoin_source_id: "bes-3", designation: "Plots réglables 40-60 mm", categorie: "plots", unite: "plots", quantite: 209 },
      { besoin_source_id: "bes-4", designation: "Vis inox A2 (boîte de 200)", categorie: "fixations", unite: "vis", quantite: 1400 },
    ],
  });

  const cmd1 = resCmd1.commande;
  assert(cmd1.numero_commande === `CMD-${annee}-0001`, `2.A: Premier numéro = CMD-${annee}-0001`);
  assert(cmd1.statut === "brouillon", "2.B: Statut initial = brouillon");
  assert(cmd1.version_source_numero === 3, "2.C: Version source mémorisée = V3");
  assert(cmd1.commentaire === "Livraison mardi matin sur chantier", "2.D: Commentaire mémorisé");
  assert(resCmd1.lignes.length === 4, "2.E: 4 lignes créées dans le snapshot");

  // Seconde commande (Chausson)
  const resCmd2 = await creerCommandeFournisseur(sbA, {
    chantier_id: "ch-1",
    fournisseur_id: fChausson.id,
    version_source_id: "cal-v3",
    lignes: [
      { besoin_source_id: "bes-3", designation: "Plots réglables 40-60 mm", categorie: "plots", unite: "plots", quantite: 50 },
    ],
  });
  const cmd2 = resCmd2.commande;
  assert(cmd2.numero_commande === `CMD-${annee}-0002`, `2.F: Numérotation séquentielle atomique = CMD-${annee}-0002 (pas de trou ni collision)`);

  // =========================================================================
  // 3. IMMUTABILITÉ DU SNAPSHOT (V3 FIGÉE MÊME APRÈS CRÉATION DE V4)
  // =========================================================================
  // Simulation de l'évolution du chantier : création de V4 avec 95 lames au lieu de 82
  db.calepinages.push({ id: "cal-v4", entreprise_id: "ent-A", chantier_id: "ch-1", version: 4 });
  // Archivage des anciens besoins V3 et création des besoins V4
  db.besoins_materiaux.forEach((b) => {
    if (b.calepinage_id === "cal-v3") b.statut = "annule";
  });
  db.besoins_materiaux.push({
    id: "bes-v4-1",
    entreprise_id: "ent-A",
    chantier_id: "ch-1",
    calepinage_id: "cal-v4",
    categorie: "lames",
    designation: "Lames Pin traité 3,00 m",
    unite: "lames",
    quantite: 95, // Nouvelle quantité V4
    statut: "a_commander",
  });

  // Relecture de la commande CMD-2026-0001
  const detailCmd1 = await getCommandeDetail(sbA, cmd1.id);
  assert(detailCmd1 !== null, "3.A: Commande CMD-0001 consultable");
  const ligneLamesCmd1 = detailCmd1!.lignes!.find((l) => l.categorie === "lames");
  assert(
    ligneLamesCmd1!.quantite === 82,
    "3.B: IMMUTABILITÉ RESPECTÉE : la commande conserve 82 lames (V3) malgré l'existence de V4 (95 lames)"
  );
  assert(detailCmd1!.version_source_numero === 3, "3.C: La commande affiche toujours 'Issue de V3'");

  // =========================================================================
  // 4. MODIFICATIONS MANUELLES DES QUANTITÉS DE COMMANDE
  // =========================================================================
  // L'artisan ajuste la quantité des vis de 1400 à 1600 pour avoir une boîte de réserve
  const ligneVis = detailCmd1!.lignes!.find((l) => l.categorie === "fixations");
  await updateLignesCommande(sbA, cmd1.id, [{ id: ligneVis!.id, quantite: 1600 }]);

  const detailApresModif = await getCommandeDetail(sbA, cmd1.id);
  const ligneVisModifiee = detailApresModif!.lignes!.find((l) => l.categorie === "fixations");
  assert(ligneVisModifiee!.quantite === 1600, "4.A: Quantité de la commande ajustée manuellement à 1600 vis");

  // Invariant : la table besoins_materiaux n'a PAS été modifiée par l'ajustement commande
  const besoinSourceVis = db.besoins_materiaux.find((b) => b.id === "bes-4");
  assert(besoinSourceVis!.quantite === 1400, "4.B: L'ajustement de commande ne modifie jamais les besoins_materiaux d'origine");

  // =========================================================================
  // 5. CYCLE DES STATUTS V1 (brouillon -> envoyee -> commandee / annulee)
  // =========================================================================
  // A. brouillon -> envoyee
  await changerStatutCommande(sbA, cmd1.id, "envoyee");
  let cmdStatus = (await getCommandeDetail(sbA, cmd1.id))!.statut;
  assert(cmdStatus === "envoyee", "5.A: Commande passée au statut 'envoyee'");

  // Tentative de modification des quantités alors que le statut est 'envoyee' -> REFUSÉ
  let errorModifBloquee = false;
  try {
    await updateLignesCommande(sbA, cmd1.id, [{ id: ligneVis!.id, quantite: 2000 }]);
  } catch (err: any) {
    errorModifBloquee = err.message.includes("brouillon");
  }
  assert(errorModifBloquee, "5.B: Modification interdite hors statut 'brouillon'");

  // B. envoyee -> commandee
  await changerStatutCommande(sbA, cmd1.id, "commandee");
  cmdStatus = (await getCommandeDetail(sbA, cmd1.id))!.statut;
  assert(cmdStatus === "commandee", "5.C: Commande confirmée au statut 'commandee'");

  // C. Annulation sur cmd2
  await changerStatutCommande(sbA, cmd2.id, "annulee");
  const cmd2Status = (await getCommandeDetail(sbA, cmd2.id))!.statut;
  assert(cmd2Status === "annulee", "5.D: Commande 2 passée au statut 'annulee'");

  // D. Statut hors périmètre refusé
  let statutInvalideRefuse = false;
  try {
    await changerStatutCommande(sbA, cmd1.id, "recu" as any);
  } catch {
    statutInvalideRefuse = true;
  }
  assert(statutInvalideRefuse, "5.E: Statut non autorisé (ex: 'recu') strictement refusé");

  // =========================================================================
  // 6. ISOLATION RLS MULTI-TENANT (ENTREPRISE A vs ENTREPRISE B)
  // =========================================================================
  // Entreprise B consulte les commandes du chantier de l'Entreprise A -> vide
  const cmdsVuesParB = await getCommandesByChantier(sbB, "ch-1");
  assert(cmdsVuesParB.length === 0, "6.A: RLS : Entreprise B ne voit AUCUNE commande de l'Entreprise A");

  // Entreprise B tente de lire la commande CMD-0001 directement
  const detailVuParB = await getCommandeDetail(sbB, cmd1.id);
  assert(detailVuParB === null, "6.B: RLS : Détail de la commande A inaccessible pour B");

  // Utilisateur non connecté -> accès bloqué
  const errAnon = await sbAnon.rpc("creer_commande_fournisseur", {
    p_chantier_id: "ch-1",
    p_fournisseur_id: fPointP.id,
    p_lignes: [{ designation: "Test", quantite: 10 }],
  });
  assert(errAnon.error !== null, "6.C: Création refusée sans session active");

  // Numérotation indépendante pour Entreprise B
  const fPointPNice = await creerFournisseur(sbB, { nom: "Point P Nice" });
  const resCmdB = await creerCommandeFournisseur(sbB, {
    chantier_id: "ch-B1",
    fournisseur_id: fPointPNice.id,
    lignes: [{ designation: "Plots Nice", categorie: "plots", unite: "plots", quantite: 100 }],
  });
  assert(
    resCmdB.commande.numero_commande === `CMD-${annee}-0001`,
    "6.D: Numérotation étanche : Entreprise B démarre son propre compteur à CMD-YYYY-0001"
  );

  // =========================================================================
  // 7. PRÉPARATION COMMANDES PARTIELLES & CHAMPS FUTURS
  // =========================================================================
  // Commande partielle avec référence fournisseur mémorisée
  const resCmdPartielle = await creerCommandeFournisseur(sbA, {
    chantier_id: "ch-1",
    fournisseur_id: fPointP.id,
    reference_fournisseur: "DEVIS-POINTP-7789",
    lignes: [
      { besoin_source_id: "bes-1", designation: "Lames uniquement", categorie: "lames", unite: "lames", quantite: 40 },
    ],
  });
  assert(
    resCmdPartielle.commande.reference_fournisseur === "DEVIS-POINTP-7789",
    "7.A: Champ d'anticipation future 'reference_fournisseur' persisté"
  );
  assert(
    resCmdPartielle.lignes[0].besoin_source_id === "bes-1",
    "7.B: Liaison optionnelle besoin_source_id conservée pour commandes partielles"
  );

  // =========================================================================
  // 8. V1.1 — DATE DE LIVRAISON SOUHAITÉE (ex: "05/11/2026 matin")
  // =========================================================================
  const resCmdLivraison = await creerCommandeFournisseur(sbA, {
    chantier_id: "ch-1",
    fournisseur_id: fPointP.id,
    date_livraison_souhaitee: "05/11/2026 matin",
    commentaire: "Livrer avec camion grue",
    lignes: [
      { designation: "Lambourdes urgentes", categorie: "lambourdes", unite: "barres", quantite: 15 },
    ],
  });
  assert(
    resCmdLivraison.commande.date_livraison_souhaitee === "05/11/2026 matin",
    "8.A: V1.1 Date de livraison souhaitée '05/11/2026 matin' mémorisée avec succès"
  );

  const detailCmdLivraison = await getCommandeDetail(sbA, resCmdLivraison.commande.id);
  assert(
    detailCmdLivraison?.date_livraison_souhaitee === "05/11/2026 matin",
    "8.B: V1.1 Date de livraison souhaitée restituée fidèlement dans le détail de commande"
  );

  console.log(`\n=== TOUTES LES ${passed} VÉRIFICATIONS COMMANDES FOURNISSEURS SONT RÉUSSIES ===`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
