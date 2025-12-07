export type ParsedDifficulty = "beginner" | "intermediate" | "advanced";

export interface ParsedRecipeFromText {
  title?: string;
  description?: string;
  servings?: number;
  prepTimeMin?: number;
  cookTimeMin?: number;
  ingredientsText?: string;
  instructionsText?: string;
  difficulty?: ParsedDifficulty;
}

/**
 * Supprime les icônes / emojis de début de ligne ainsi que les puces.
 * L'objectif est d'obtenir une ligne texte exploitable.
 */
const stripIconPrefix = (line: string): string => {
  if (!line) return "";
  // Retire les puces simples (•) et espaces de début
  let trimmed = line.replace(/^•\s*/, "").trim();
  // Retire les emojis / symboles de début de ligne (approximation basée sur les caractères non alphanumériques)
  trimmed = trimmed.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "").trim();

  return trimmed;
};

const normalizeText = (raw: string): string =>
  raw.replace(/\r\n/g, "\n").replace(/\u00A0/g, " ").trim();

/**
 * Parse un texte brut de recette (avec sections Ingrédients / Préparation, emojis, etc.)
 * et renvoie une structure partielle permettant de pré-remplir le formulaire.
 *
 * Cette fonction est volontairement "best effort" : elle ne couvre pas tous les cas,
 * mais vise à fonctionner correctement pour les formats utilisés dans Chefito.
 */
export const parseRecipeFromRawText = (raw: string): ParsedRecipeFromText => {
  const text = normalizeText(raw);
  if (!text) {
    return {};
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

  if (lines.length === 0) {
    return {};
  }

  let title: string | undefined;
  let servings: number | undefined;
  let description: string | undefined;
  let difficulty: ParsedDifficulty | undefined;
  let prepTimeMin: number | undefined;
  let cookTimeMin: number | undefined;
  let ingredientsText: string | undefined;
  let instructionsText: string | undefined;

  // --- Titre & portions (ex. "🥗 Patate douce ... (4 personnes)")
  const titleLine = lines.find(
    (l) =>
      /🥗/.test(l) || /\(\s*\d+\s*(?:pers?\.?|personnes?)\s*\)/i.test(l)
  );
  if (titleLine) {
    const noIcon = stripIconPrefix(titleLine);
    const servingsMatch = noIcon.match(
      /\(\s*(\d+)\s*(?:pers?\.?|personnes?)\s*\)/i
    );
    if (servingsMatch) {
      servings = Number(servingsMatch[1]);
    }
    const titleClean = noIcon
      .replace(/\(\s*\d+\s*(?:pers?\.?|personnes?)\s*\)/i, "")
      .trim();
    if (titleClean) {
      title = titleClean;
    }
  }

  // --- Description courte : après "Petite histoire" si présent, sinon premier paragraphe un peu long
  const idxPetite = lines.findIndex((l) =>
    /petite histoire/i.test(stripIconPrefix(l))
  );
  const idxIngr = lines.findIndex((l) =>
    /ingr[eé]dients?/i.test(stripIconPrefix(l))
  );

  if (idxPetite !== -1) {
    const end = idxIngr !== -1 ? idxIngr : lines.length;
    const descLines = lines
      .slice(idxPetite + 1, end)
      .map((l) => stripIconPrefix(l))
      .filter((l) => l.length > 0);
    if (descLines.length > 0) {
      description = descLines.join(" ");
    }
  } else {
    const descCandidate = lines.find((l) => {
      if (l === titleLine) return false;
      const s = stripIconPrefix(l).toLowerCase();
      if (/ingr[eé]dients?/.test(s)) return false;
      if (/pr[eé]paration/.test(s)) return false;
      if (/ustensiles/.test(s)) return false;
      return s.length > 40;
    });
    if (descCandidate) {
      description = stripIconPrefix(descCandidate);
    }
  }

  // --- Difficulté (ex. "⭐ Difficulté : Facile")
  const diffLine = lines.find((l) =>
    /difficul/i.test(stripIconPrefix(l))
  );
  if (diffLine) {
    const lc = diffLine.toLowerCase();
    if (lc.includes("facile") || lc.includes("simple")) {
      difficulty = "beginner";
    } else if (lc.includes("intermédiaire") || lc.includes("intermediaire")) {
      difficulty = "intermediate";
    } else if (lc.includes("avancé") || lc.includes("avance")) {
      difficulty = "advanced";
    }
  }

  // --- Temps de préparation & cuisson (recherche globale dans le texte)
  const prepMatch = text.match(
    /pr[eé]paration[^:\n]*:\s*(\d+)\s*(?:min|minutes?)/i
  );
  if (prepMatch) {
    prepTimeMin = Number(prepMatch[1]);
  }

  const cookMatch = text.match(
    /cuisson[^:\n]*:\s*(\d+)(?:\s*(?:à|\-)\s*(\d+))?\s*(?:min|minutes?)/i
  );
  if (cookMatch) {
    const a = Number(cookMatch[1]);
    const rawB = cookMatch[2];
    let b: number | null = null;
    if (rawB) {
      const parsedB = Number(rawB);
      if (!Number.isNaN(parsedB)) {
        b = parsedB;
      }
    }
    cookTimeMin =
      typeof b === "number" ? Math.round((a + b) / 2) : a;
  }

  // --- Bloc Ingrédients -> ingredientsText
  if (idxIngr !== -1) {
    let ingredientsEndIdx = lines.length;
    for (let i = idxIngr + 1; i < lines.length; i += 1) {
      const s = stripIconPrefix(lines[i]).toLowerCase();
      if (/pr[eé]paration/.test(s)) {
        ingredientsEndIdx = i;
        break;
      }
    }

    const rawIngLines = lines.slice(idxIngr + 1, ingredientsEndIdx);
    const cleanedIngLines = rawIngLines
      .map((l) => stripIconPrefix(l))
      .filter((l) => {
        if (!l) return false;
        if (/^option\b/i.test(l)) return false;
        return true;
      });

    if (cleanedIngLines.length > 0) {
      ingredientsText = cleanedIngLines.join("\n");
    }
  }

  // --- Bloc Préparation -> instructionsText
  const idxPrep = lines.findIndex((l) =>
    /pr[eé]paration pas à pas|pr[eé]paration|preparation/i.test(
      stripIconPrefix(l)
    )
  );
  if (idxPrep !== -1) {
    let endIdx = lines.length;
    for (let i = idxPrep + 1; i < lines.length; i += 1) {
      const s = stripIconPrefix(lines[i]).toLowerCase();
      if (
        /conservation/.test(s) ||
        /meal prep/.test(s) ||
        /anecdote/.test(s) ||
        /tag trello/.test(s)
      ) {
        endIdx = i;
        break;
      }
    }

    const rawStepLines = lines.slice(idxPrep + 1, endIdx);
    const cleanedStepLines = rawStepLines
      .map((l) =>
        stripIconPrefix(l)
          // Supprime un éventuel numéro d'étape au début (1., 2), 3️⃣, etc.)
          .replace(/^[0-9]+[)º°.\-:]?\s*/, "")
          .trim()
      )
      .filter((l) => l.length > 0);

    if (cleanedStepLines.length > 0) {
      instructionsText = cleanedStepLines.join("\n\n");
    }
  }

  return {
    title,
    description,
    servings,
    prepTimeMin,
    cookTimeMin,
    ingredientsText,
    instructionsText,
    difficulty
  };
};

export interface ParsedIngredientLine {
  originalText: string;
  quantity?: number;
  unit?: string;
  name: string;
}

const parseQuantity = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Fractions simples (ex. 1/2)
  const fracMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (!Number.isNaN(num) && !Number.isNaN(den) && den !== 0) {
      return num / den;
    }
    return undefined;
  }

  const normalized = trimmed.replace(",", ".");
  const n = Number(normalized);
  if (Number.isNaN(n)) {
    return undefined;
  }
  return n;
};

const normalizeUnitToken = (raw: string): string | undefined => {
  const base = raw.trim().toLowerCase().replace(/\./g, "");
  if (!base) return undefined;

  if (base === "g" || base === "gr" || base === "gramme" || base === "grammes") {
    return "g";
  }
  if (base === "kg" || base === "kilogramme" || base === "kilogrammes") {
    return "kg";
  }
  if (base === "mg") {
    return "mg";
  }
  if (base === "ml") {
    return "ml";
  }
  if (base === "cl") {
    return "cl";
  }
  if (base === "l" || base === "litre" || base === "litres") {
    return "l";
  }
  if (base === "botte" || base === "bottes") {
    return "botte";
  }
  if (base === "pincee" || base === "pincée" || base === "pincees" || base === "pincées") {
    return "pincée";
  }

  return undefined;
};

/**
 * Transforme un bloc d'ingrédients texte (une ligne par ingrédient)
 * en structure (quantité, unité, nom) pour pré-remplir les ingrédients normalisés.
 */
export const parseIngredientsTextToStructured = (
  ingredientsText: string
): ParsedIngredientLine[] => {
  const text = normalizeText(ingredientsText);
  if (!text) return [];

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

  const result: ParsedIngredientLine[] = [];

  lines.forEach((rawLine) => {
    const line = stripIconPrefix(rawLine);
    if (!line) return;

    // Ignorer les en-têtes de section ou les options
    if (/^\[.*\]$/.test(line)) return;
    if (/^option\b/i.test(line)) return;

    let quantity: number | undefined;
    let unit: string | undefined;
    let name: string;

    // Quantité au début de la ligne
    const quantityMatch = line.match(
      /^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s+(.*)$/
    );
    if (quantityMatch) {
      quantity = parseQuantity(quantityMatch[1]);
      const rest = quantityMatch[2];

      // Essaye de détecter une unité simple comme premier token
      const unitMatch = rest.match(/^([A-Za-zÀ-ÿ\.]+)\s+(.*)$/);
      if (unitMatch) {
        const normalizedUnit = normalizeUnitToken(unitMatch[1]);
        if (normalizedUnit) {
          unit = normalizedUnit;
          name = unitMatch[2].trim();
        } else {
          name = rest.trim();
        }
      } else {
        name = rest.trim();
      }
    } else {
      // Pas de quantité détectée → tout est le nom
      name = line;
    }

    if (!name) {
      return;
    }

    result.push({
      originalText: rawLine,
      quantity,
      unit,
      name
    });
  });

  return result;
};