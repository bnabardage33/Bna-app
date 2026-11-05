#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
production_ref="cqrxqmfefnhurqrlxxwc"
db_name="${PGDATABASE:-bna_finance_test}"
db_host="${PGHOST:-127.0.0.1}"
db_port="${PGPORT:-5432}"
db_user="${PGUSER:-bna_test_admin}"

fail() { printf 'ERREUR: %s\n' "$1" >&2; exit 1; }

[[ "$db_name" == "bna_finance_test" ]] || fail "PGDATABASE doit être exactement bna_finance_test."
[[ "$db_host" == "127.0.0.1" || "$db_host" == "localhost" || "$db_host" == "::1" ]] || fail "PGHOST doit être une adresse loopback locale."
[[ "$db_user" == "bna_test_admin" ]] || fail "PGUSER doit être le rôle local dédié bna_test_admin."
[[ "$db_port" =~ ^[0-9]+$ ]] || fail "PGPORT invalide."

connection_settings="${PGHOST:-} ${PGHOSTADDR:-} ${PGSERVICE:-} ${PGSERVICEFILE:-} ${DATABASE_URL:-}"
[[ "$connection_settings" != *"$production_ref"* ]] || fail "Référence du projet Supabase de production détectée dans les paramètres de connexion."
[[ -z "${PGSERVICE:-}" && -z "${PGSERVICEFILE:-}" ]] || fail "Les profils PGSERVICE sont interdits pour éviter toute connexion indirecte."
[[ -z "${PGPASSWORD:-}" && -z "${PGPASSFILE:-}" ]] || fail "Les mots de passe et fichiers pgpass sont interdits : utilisez l'authentification locale du serveur de test."
[[ -z "${DATABASE_URL:-}" ]] || fail "DATABASE_URL est interdite pour ce runner."

if [[ "${BNA_FINANCE_ALLOW_POSTGRES_18:-0}" != "1" ]]; then
  required_major=17
else
  required_major=18
fi

export PGHOST="$db_host" PGPORT="$db_port" PGUSER="$db_user" PGDATABASE="$db_name"
unset PGPASSWORD PGPASSFILE PGSERVICE PGSERVICEFILE DATABASE_URL
psql_cmd=(psql -X --no-psqlrc -v ON_ERROR_STOP=1 -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name")

version_num="$("${psql_cmd[@]}" -Atqc 'SHOW server_version_num')"
server_version="$("${psql_cmd[@]}" -Atqc 'SHOW server_version')"
server_major="$((version_num / 10000))"
[[ "$server_major" == "$required_major" ]] || fail "PostgreSQL $required_major requis (version détectée : $server_version)."

guard_result="$("${psql_cmd[@]}" -Atqc "SELECT current_database() = 'bna_finance_test' AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AND rolsuper FROM pg_roles WHERE rolname = current_user")"
[[ "$guard_result" == "t" ]] || fail "Garde-fou échoué : base dédiée, serveur loopback et rôle superutilisateur local requis."

printf 'Base locale isolée confirmée : %s, PostgreSQL %s, hôte %s:%s.\n' "$db_name" "$server_version" "$db_host" "$db_port"
printf 'Réinitialisation des seuls schémas public et auth de cette base de test dédiée.\n'
"${psql_cmd[@]}" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO bna_test_admin;
SQL

"${psql_cmd[@]}" -f "$repo_root/supabase/tests/fixtures/financial_phase1_bootstrap.sql"
"${psql_cmd[@]}" -f "$repo_root/supabase/migrations/20261029000001_socle_entreprises_profils.sql"
"${psql_cmd[@]}" -f "$repo_root/supabase/migrations/20261029000002_clients_chantiers.sql"
"${psql_cmd[@]}" -f "$repo_root/supabase/migrations/20261030000005_clients_contacts_chantiers.sql"
"${psql_cmd[@]}" -f "$repo_root/supabase/tests/fixtures/financial_phase1_counters.sql"
"${psql_cmd[@]}" -f "$repo_root/supabase/migrations/20261105101502_socle_financier_phase1.sql"
"${psql_cmd[@]}" -f "$repo_root/supabase/migrations/20261105101528_socle_financier_phase1_rpc_permissions.sql"
"${psql_cmd[@]}" -f "$repo_root/supabase/tests/financial_phase1.integration.sql"

printf 'Suite d’intégration financière réussie.\n'
