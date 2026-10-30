/**
 * Normalisation intelligente des noms propres, prénoms, villes et noms de chantier.
 * Met en majuscule l'initiale de chaque mot et partie de mot composé (séparés par espace ou tiret),
 * tout en respectant les minuscules pour les particules de liaison françaises usuelles en milieu de nom
 * (ex: Saint-André-de-Cubzac, La Teste-de-Buch, Jean-Pierre, Le Haillan).
 */
export function normalizeTitleCase(input: string): string {
  if (!input) return "";

  const str = input.trim();
  if (!str) return "";

  // Particules françaises usuelles à conserver en minuscule en milieu de nom composé
  const lowerParticles = new Set(["de", "des", "du", "sur", "sous", "en", "aux", "au", "et"]);

  // Découpage par espace
  const spaceTokens = str.split(/\s+/);

  const formattedTokens = spaceTokens.map((token, tokenIdx) => {
    // Si le token contient des tirets (ex: "saint-andré-de-cubzac", "jean-pierre")
    const subParts = token.split("-");

    const formattedSubParts = subParts.map((part, subIdx) => {
      if (!part) return "";

      const lower = part.toLowerCase();

      // Gestion des élisions comme d' ou l' (ex: d'Arcachon)
      if (lower.startsWith("d'") || lower.startsWith("l'") || lower.startsWith("d’") || lower.startsWith("l’")) {
        const prefix = lower.slice(0, 2);
        const rest = lower.slice(2);
        return prefix + (rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "");
      }

      // Si c'est une particule en milieu de nom (pas le premier mot de la chaîne globale)
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
export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}
