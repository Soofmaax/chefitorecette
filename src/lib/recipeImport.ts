import type { RecipeFormValues } from "@/types/forms";

export type ParsedDifficulty = "beginner" | "intermediate" | "advanced";

export type ParsedDietaryLabel = RecipeFormValues["dietary_labels"][number];
export type ParsedServingTemperature =
  RecipeFormValues["serving_temperatures"][number];
export type ParsedStorageMode = RecipeFormValues["storage_modes"][number];

export interface ParsedRecipeFromText {
  title?: string;
  description?: string;
  servings?: number;
  prepTimeMin?: number;
  cookTimeMin?: number;
  restTimeMin?: number;
  ingredientsText?: string;
  instructionsText?: string;
  difficulty?: ParsedDifficulty;
  // Informations complémentaires pour automatiser davantage le formulaire
  storageDurationDays?: number;
  storageInstructions?: string;
  tags?: string[];
  utensils?: string[];
  chefTips?: string;
  culturalHistory?: string;
  techniques?: string;
  nutritionalNotes?: string;
  dietaryLabels?: ParsedDietaryLabel[];
  servingTemperatures?: ParsedServingTemperature[];
  storageModes?: ParsedStorageMode[];
  sourceInfo?: string;
}

export interface ParsedStepFromText {
  instruction: string;
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
  let restTimeMin: number | undefined;
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

  // --- Temps de repos (approximation à partir de formulations comme "laisser reposer X min")
  const restMatch =
    text.match(/repos[^0-9]{0,20}(\d+)\s*(?:min|minutes?)/i) ||
    text.match(/reposer[^0-9]{0,20}(\d+)\s*(?:min|minutes?)/i);
  if (restMatch) {
    const r = Number(restMatch[1]);
    if (!Number.isNaN(r)) {
      restTimeMin = r;
    }
  }

  // --- Bloc Ingrédients -> ingredientsTextkMatch = text.match(
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

  // --- Bloc Conservation -> storageDurationDays / storageInstructions
  let storageDurationDays: number | undefined;
  let storageInstructions: string | undefined;
  const idxCons = lines.findIndex((l) =>
    /conservation/i.test(stripIconPrefix(l))
  );
  if (idxCons !== -1) {
    let endIdx = lines.length;
    for (let i = idxCons + 1; i < lines.length; i += 1) {
      const s = stripIconPrefix(lines[i]).toLowerCase();
      if (/meal prep/.test(s) || /anecdote/.test(s) || /tag trello/.test(s)) {
        endIdx = i;
        break;
      }
    }
    const consLines = lines
      .slice(idxCons, endIdx)
      .map((l) => stripIconPrefix(l))
      .filter((l) => l.length > 0);
    if (consLines.length > 0) {
      storageInstructions = consLines.join(" ");
    }

    const consText = consLines.join(" ");
    const daysMatch = consText.match(/(\d+)\s*(?:jour|jours|j)\b/i);
    if (daysMatch) {
      const d = Number(daysMatch[1]);
      if (!Number.isNaN(d)) {
        storageDurationDays = d;
      }
    } else {
      const hoursMatch = consText.match(/(\d+)\s*h\b/i);
      if (hoursMatch) {
        const h = Number(hoursMatch[1]);
        if (!Number.isNaN(h)) {
          const approxDays = Math.max(1, Math.round(h / 24));
          storageDurationDays = approxDays;
        }
      }
    }
  }

  // --- Histoire / anecdote -> culturalHistory
  let culturalHistory: string | undefined;
  const idxAnecdote = lines.findIndex((l) =>
    /anecdote/i.test(stripIconPrefix(l))
  );
  if (idxAnecdote !== -1) {
    let endIdx = lines.length;
    for (let i = idxAnecdote + 1; i < lines.length; i += 1) {
      const s = stripIconPrefix(lines[i]).toLowerCase();
      if (/tag trello/.test(s)) {
        endIdx = i;
        break;
      }
    }
    const histLines = lines
      .slice(idxAnecdote + 1, endIdx)
      .map((l) => stripIconPrefix(l))
      .filter((l) => l.length > 0);

    const petiteLines: string[] = [];
    if (idxPetite !== -1) {
      const end = idxIngr !== -1 ? idxIngr : lines.length;
      petiteLines.push(
        ...lines
          .slice(idxPetite + 1, end)
          .map((l) => stripIconPrefix(l))
          .filter((l) => l.length > 0)
      );
    }

    const allHist = [...petiteLines, ...histLines];
    if (allHist.length > 0) {
      culturalHistory = allHist.join(" ");
    }
  } else if (idxPetite !== -1) {
    const end = idxIngr !== -1 ? idxIngr : lines.length;
    const petiteLines = lines
      .slice(idxPetite + 1, end)
      .map((l) => stripIconPrefix(l))
      .filter((l) => l.length > 0);
    if (petiteLines.length > 0) {
      culturalHistory = petiteLines.join(" ");
    }
  }

  // --- Astuces / options -> chefTips
  const tipsLines: string[] = [];
  lines.forEach((l) => {
    const s = stripIconPrefix(l);
    if (/^option\b/i.test(s) || /astuce/i.test(s) || /astuces/i.test(s)) {
      tipsLines.push(s);
    }
  });
  const chefTips = tipsLines.length > 0 ? tipsLines.join(" ") : undefined;

  // --- Techniques (section dédiée si présente)
  let techniques: string | undefined;
  const idxTech = lines.findIndex((l) =>
    /techniques?/i.test(stripIconPrefix(l))
  );
  if (idxTech !== -1) {
    let endIdx = lines.length;
    for (let i = idxTech + 1; i < lines.length; i += 1) {
      const s = stripIconPrefix(lines[i]).toLowerCase();
      if (
        /conservation/.test(s) ||
        /meal prep/.test(s) ||
        /anecdote/.test(s) ||
        /notes? nutrition/i.test(s) ||
        /tag trello/.test(s)
      ) {
        endIdx = i;
        break;
      }
    }
    const techLines = lines
      .slice(idxTech + 1, endIdx)
      .map((l) => stripIconPrefix(l))
      .filter((l) => l.length > 0);
    if (techLines.length > 0) {
      techniques = techLines.join(" ");
    }
  }

  // --- Notes nutritionnelles (section dédiée si présente)
  let nutritionalNotes: string | undefined;
  const idxNutri = lines.findIndex((l) =>
    /notes? nutrition|c[oô]t[eé] nutrition/i.test(stripIconPrefix(l))
  );
  if (idxNutri !== -1) {
    let endIdx = lines.length;
    for (let i = idxNutri + 1; i < lines.length; i += 1) {
      const s = stripIconPrefix(lines[i]).toLowerCase();
      if (/tag trello/.test(s)) {
        endIdx = i;
        break;
      }
    }
    const nutriLines = lines
      .slice(idxNutri + 1, endIdx)
      .map((l) => stripIconPrefix(l))
      .filter((l) => l.length > 0);
    if (nutriLines.length > 0) {
      nutritionalNotes = nutriLines.join(" ");
    }
  }

  // --- Source (ex. "Source : ...")
  let sourceInfo: string | undefined;
  const sourceLine = lines.find((l) =>
    /^source\b/i.test(stripIconPrefix(l))
  );
  if (sourceLine) {
    const s = stripIconPrefix(sourceLine);
    const m = s.match(/^source\s*:\s*(.+)$/i);
    if (m && m[1].trim()) {
      sourceInfo = m[1].trim();
    } else if (s.trim().length > 6) {
      sourceInfo = s.trim();
    }
  }

  // --- Tags simples (ex. "Tag Trello : ...")
  const tags: string[] = [];
  lines.forEach((l) => {
    const s = stripIconPrefix(l);
    const match = s.match(/tag\s+trello\s*:\s*(.+)$/i);
    if (match) {
      const tagRaw = match[1].trim();
      if (tagRaw) {
        tags.push(tagRaw);
      }
    }
  });

  // --- Ustensiles (ex. "Ustensiles nécessaires : ...")
  const utensils: string[] = [];
  const idxUst = lines.findIndex((l) =>
    /ustensiles/i.test(stripIconPrefix(l))
  );
  if (idxUst !== -1) {
    let endIdx = lines.length;
    for (let i = idxUst + 1; i < lines.length; i += 1) {
      const s = stripIconPrefix(lines[i]).toLowerCase();
      if (
        /temps de pr[eé]paration/.test(s) ||
        /temps de cuisson/.test(s) ||
        /pr[eé]paration/.test(s) ||
        /conservation/.test(s) ||
        /meal prep/.test(s) ||
        /anecdote/.test(s) ||
        /tag trello/.test(s)
      ) {
        endIdx = i;
        break;
      }
    }

    const ustLines = lines
      .slice(idxUst + 1, endIdx)
      .map((l) => stripIconPrefix(l))
      .filter((l) => l.length > 0);

    ustLines.forEach((raw) => {
      // Exemple : "1 couteau économe" -> "couteau économe"
      const m = raw.match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/);
      const label = m ? m[2].trim() : raw.trim();
      if (label) {
        utensils.push(label);
      }
    });
  }

  // --- Labels alimentaires (végétarien, vegan, sans gluten, etc.)
  const dietaryLabels: ParsedDietaryLabel[] = [];
  const addDietary = (label: ParsedDietaryLabel) => {
    if (!dietaryLabels.includes(label)) {
      dietaryLabels.push(label);
    }
  };

  const lcText = text.toLowerCase();

  if (/vegan/.test(lcText)) {
    addDietary("vegan");
  }
  if (/(végétalien|vegetalien)/.test(lcText)) {
    addDietary("vegetalien");
  }
  if (/(végétarien|vegetarien)/.test(lcText)) {
    addDietary("vegetarien");
  }
  if (/pesc[ée]tarien/.test(lcText)) {
    addDietary("pescetarien");
  }
  if (/sans gluten/.test(lcText)) {
    addDietary("sans_gluten");
  }
  if (/sans lactose/.test(lcText)) {
    addDietary("sans_lactose");
  }
  if (/sans\s+(?:œuf|oeuf)s?/.test(lcText)) {
    addDietary("sans_oeuf");
  }
  if (/sans arachide/.test(lcText)) {
    addDietary("sans_arachide");
  }
  if (/sans fruits?\s+à\s+coque|sans fruits?\s+a\s+coque/.test(lcText)) {
    addDietary("sans_fruits_a_coque");
  }
  if (/sans soja/.test(lcText)) {
    addDietary("sans_soja");
  }
  if (/sans sucre ajout[é|e]/.test(lcText)) {
    addDietary("sans_sucre_ajoute");
  }
  if (/sans sel ajout[é|e]/.test(lcText)) {
    addDietary("sans_sel_ajoute");
  }
  if (/halal/.test(lcText)) {
    addDietary("halal");
  }
  if (/(casher|kasher)/.test(lcText)) {
    addDietary("casher");
  }

  // --- Température de service
  const servingTemperatures: ParsedServingTemperature[] = [];
  const addServing = (value: ParsedServingTemperature) => {
    if (!servingTemperatures.includes(value)) {
      servingTemperatures.push(value);
    }
  };

  if (
    /servir[^.]*chaud|d[ée]guster[^.]*chaud|bien chaud/.test(lcText)
  ) {
    addServing("chaud");
  }
  if (/servir[^.]*ti[èe]de|ti[èe]de/.test(lcText)) {
    addServing("tiede");
  }
  if (/temp[ée]rature ambiante/.test(lcText)) {
    addServing("ambiante");
  }
  if (/servir[^.]*froid|servir[^.]*bien frais|bien frais/.test(lcText)) {
    addServing("froid");
  }
  if (servingTemperatures.length > 1) {
    addServing("au_choix");
  }

  // --- Modes de conservation
  const storageModes: ParsedStorageMode[] = [];
  const addStorageMode = (value: ParsedStorageMode) => {
    if (!storageModes.includes(value)) {
      storageModes.push(value);
    }
  };

  if (/r[ée]frig[ée]rateur|frigo|au frais/.test(lcText)) {
    addStorageMode("refrigerateur");
  }
  if (/congel[ée]|cong[ée]lateur|congelateur/.test(lcText)) {
    addStorageMode("congelateur");
  }
  if (/temp[ée]rature ambiante/.test(lcText)) {
    addStorageMode("ambiante");
  }
  if (/sous vide/.test(lcText)) {
    addStorageMode("sous_vide");
  }
  if (/bo[iî]te herm[ée]tique|tupperware/.test(lcText)) {
    addStorageMode("boite_hermetique");
  }
  if (storageModes.length > 1) {
    addStorageMode("au_choix");
  }

  return {
    title,
    description,
    servings,
    prepTimeMin,
    cookTimeMin,
    restTimeMin,
    ingredientsText,
    instructionsText,
    difficulty,
    storageDurationDays,
    storageInstructions,
    tags: tags.length > 0 ? Array.from(new Set(tags)) : undefined,
    utensils: utensils.length > 0 ? Array.from(new Set(utensils)) : undefined,
    chefTips,
    culturalHistory,
    techniques,
    nutritionalNotes,
    dietaryLabels: dietaryLabels.length > 0 ? dietaryLabels : undefined,
    servingTemperatures:
      servingTemperatures.length > 0 ? servingTemperatures : undefined,
    storageModes: storageModes.length > 0 ? storageModes : undefined,
    sourceInfo
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

export const parseInstructionsToSteps = (
  instructionsText: string
): ParsedStepFromText[] => {
  const text = normalizeText(instructionsText);
  if (!text) return [];

  // On commence par découper en paragraphes séparés par des lignes vides.
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "");

  const chunks =
    paragraphs.length > 1
      ? paragraphs
      : text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l !== "");

  const steps: ParsedStepFromText[] = [];

  chunks.forEach((raw) => {
    let line = stripIconPrefix(raw);
    // Supprime un éventuel numéro d'étape au début (1., 2), 3️⃣, etc.)
    line = line.replace(/^[0-9]+[)º°.\-:]?\s*/, "").trim();
    if (!line) return;

    steps.push({ instruction: line });
  });

  return steps;
};