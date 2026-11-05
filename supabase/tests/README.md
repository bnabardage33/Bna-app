# Tests PostgreSQL du socle financier Phase 1

La suite est une campagne SQL autonome qui rejoue les migrations financières locales dans une base PostgreSQL de test dédiée. Elle ne se connecte pas à Supabase et n'utilise aucun secret distant.

## Prérequis

- PostgreSQL local 17.x (la production est en 17.11), `psql` compatible et le rôle superutilisateur local `bna_test_admin`.
- Une base dédiée nommée exactement `bna_finance_test`, sur une adresse loopback (`127.0.0.1`, `localhost` ou `::1`).
- Authentification locale sans mot de passe pour ce rôle. Le runner refuse `PGPASSWORD`, `PGPASSFILE`, `PGSERVICE`, `PGSERVICEFILE`, `DATABASE_URL`, les hôtes distants et le nom du projet Supabase de production.

Créer le cluster et la base de test selon les outils de la machine. Exemple pour une installation PostgreSQL locale où le cluster est déjà démarré :

```sh
sudo -u postgres createuser --superuser bna_test_admin
sudo -u postgres createdb --owner=bna_test_admin bna_finance_test
```

Configurer `pg_hba.conf` pour permettre au rôle dédié de se connecter en local sans secret de production. Ne réutilisez jamais une connexion par tunnel vers Supabase.

## Exécution

Avec PostgreSQL 17 :

```sh
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=bna_test_admin PGDATABASE=bna_finance_test \
  scripts/test-financial-postgres.sh
```

Le runner vérifie la version, l'adresse loopback, le nom exact de la base et le caractère superutilisateur du rôle. Il supprime puis recrée uniquement les schémas `public` et `auth` de `bna_finance_test`, applique les migrations locales `20261029000001`, `20261029000002`, `20261030000005`, le bootstrap de test du compteur, puis les deux migrations financières canoniques `20261105101502` et `20261105101528`. Il lance enfin `financial_phase1.integration.sql` avec `ON_ERROR_STOP`.

**Cette commande réinitialise entièrement ces deux schémas.** N'utilisez qu'une base jetable dédiée. Le script SQL place les fixtures et les tests dans une transaction puis fait `ROLLBACK`; le runner réapplique les migrations au début de chaque lancement. Un code de sortie différent de zéro indique un échec.

Le bootstrap `financial_phase1_bootstrap.sql` fournit uniquement une table `auth.users` minimale et `auth.uid()` simulant le claim JWT local. `financial_phase1_counters.sql` définit le minimum de `compteurs_numerotation` attendu par la migration financière. Ce ne sont pas des migrations de production.

## Couverture

Le fichier `financial_phase1.integration.sql` couvre les devis multiligne, calculs HT/TVA/TTC, signature et suppression de brouillon; payloads invalides des trois RPC; émission directe et depuis un devis; acompte, situations cumulées 65 %/80 %, solde et dépassement de quantité; arrondi ligne par ligne; avoir ciblé et avoirs globaux `CONTRACT` / `INVOICES`, plafonds par taux, déduplication et réservations; factures émises tardivement; immutabilité; opérations INSERT/UPDATE/DELETE des trois tables de lignes, parents absents ou tenant incohérent, déplacement de ligne; RLS, isolation entre deux entreprises et permissions des rôles `anon` / `authenticated`.

Le test commence par vérifier que `proteger_document_financier_emis()` contient les branches distinctes pour les trois tables de lignes et que les cinq triggers attendus sont actifs. Il ne désactive aucun trigger. Toutes les données utilisent des identifiants et noms fictifs.

## PostgreSQL 18

La suite privilégie PostgreSQL 17 et refuse une autre version par défaut. Un passage sur PostgreSQL 18 est disponible uniquement avec l'opt-in explicite `BNA_FINANCE_ALLOW_POSTGRES_18=1`; il ne remplace pas une validation sur PostgreSQL 17.
