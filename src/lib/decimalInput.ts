/**
 * Utilitaire de gestion des saisies décimales pour les formulaires BNA (mobile-first).
 */

export const DECIMAL_REGEX = /^\d*[.,]?\d*$/;

/**
 * Valide si la chaîne saisie correspond à un format décimal en cours d'édition.
 * Autorise "", "2", "2,", "2.", "2,1", "2.10".
 */
export function isValidDecimalInput(value: string): boolean {
  return DECIMAL_REGEX.test(value);
}

/**
 * Convertit une chaîne de saisie décimale en number ou null si incomplète/vide.
 * Accepte indifféremment la virgule ou le point.
 */
export function parseDecimal(value: string): number | null {
  const normalized = value.replace(",", ".").trim();

  if (
    normalized === "" ||
    normalized === "." ||
    normalized === "-"
  ) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
