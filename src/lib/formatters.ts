/**
 * Normalisation intelligente des noms propres, prénoms, villes, adresses et noms de chantier.
 * Met en majuscule l'initiale de chaque mot et partie de mot composé (séparés par espace ou tiret),
 * tout en respectant les minuscules pour les particules de liaison françaises usuelles en milieu de nom
 * (ex: Saint-André-de-Cubzac, La Teste-de-Buch, Jean-Pierre, Le Haillan, Rue de la Chapelle).
 */
export function normalizeTitleCase(input?: string | null): string {
  if (!input) return "";

  const str = input.trim();
  if (!str) return "";

  // Particules et articles de liaison à conserver en minuscule en milieu de nom/adresse
  const lowerParticles = new Set([
    "de",
    "des",
    "du",
    "la",
    "le",
    "les",
    "sur",
    "sous",
    "en",
    "aux",
    "au",
    "et",
  ]);

  // Découpage par espace
  const spaceTokens = str.split(/\s+/);

  const formattedTokens = spaceTokens.map((token, tokenIdx) => {
    // Si le token contient des tirets (ex: "saint-andré-de-cubzac", "jean-pierre")
    const subParts = token.split("-");

    const formattedSubParts = subParts.map((part, subIdx) => {
      if (!part) return "";

      const lower = part.toLowerCase();

      // Gestion des élisions comme d' ou l' (ex: d'Arcachon, l'Union)
      if (
        lower.startsWith("d'") ||
        lower.startsWith("l'") ||
        lower.startsWith("d’") ||
        lower.startsWith("l’")
      ) {
        const prefix = lower.slice(0, 2);
        const rest = lower.slice(2);
        return prefix + (rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "");
      }

      // Si c'est une particule en milieu de nom/adresse (pas le premier mot de la chaîne globale)
      const isInitial = tokenIdx === 0 && subIdx === 0;
      if (!isInitial && lowerParticles.has(lower)) {
        return lower;
      }

      // Majuscule initiale standard
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    });

    return formattedSubParts.join("-");
  });

  return formattedTokens.join(" ");
}

/**
 * Normalise une adresse email en minuscules et sans espaces superflus.
 */
export function normalizeEmail(email?: string | null): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Formate un numéro de téléphone français courant pour l'affichage :
 * 0612345678 -> 06 12 34 56 78
 * Ne modifie pas la valeur stockée en base.
 */
export function formatPhoneNumber(tel?: string | null): string {
  if (!tel) return "";
  const trimmed = tel.trim();
  const cleaned = trimmed.replace(/[\s.-]/g, "");

  // Format 10 chiffres (ex: 0612345678 -> 06 12 34 56 78)
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  }

  // Format international avec indicatif +33 (ex: +33612345678 -> +33 6 12 34 56 78)
  if (/^\+33[1-9]\d{8}$/.test(cleaned)) {
    return cleaned.replace(/^(\+33)([1-9])(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5 $6");
  }

  return trimmed;
}
