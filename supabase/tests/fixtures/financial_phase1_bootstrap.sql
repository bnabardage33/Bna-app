-- Test-only Supabase Auth and numbering prerequisites for a standalone PostgreSQL DB.
-- This file is applied only after the runner has verified the isolated test database.
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO PUBLIC;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY
);

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
