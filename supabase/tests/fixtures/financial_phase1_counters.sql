-- Minimal local test equivalent of the counter table established by the supplier module.
CREATE TABLE public.compteurs_numerotation (
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  type_document text NOT NULL,
  annee integer NOT NULL,
  dernier_numero integer NOT NULL DEFAULT 0,
  PRIMARY KEY (entreprise_id, type_document, annee)
);
