import fs from "fs";
import path from "path";
import { supabaseAdmin } from "../src/lib/supabaseAdmin";

type IngredientCsvRow = {
  ingredient_id: string;
  canonical_name: string;
  label_fr: string;
  category: string;
  default_unit: string;
  vegan: string;
  vegetarian: string;
  gluten_free: string;
  dairy_free: string;
  notes: string;
};

type IngredientDbRow = {
  canonical_name: string;
  display_name: string;
  category: string;
  scientific_name: string | null;
  audio_key: string | null;
};

async function parseCsv(filePath: string): Promise<IngredientCsvRow[]> {
  const raw = await fs.promises.readFile(filePath, "utf8");

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("Le fichier CSV ne contient pas de données.");
  }

  const header = lines[0].split(";").map((h) => h.trim());
  const expectedHeader = [
    "ingredient_id",
    "canonical_name",
    "label_fr",
    "category",
    "default_unit",
    "vegan",
    "vegetarian",
    "gluten_free",
    "dairy_free",
    "notes"
  ];

  const headerOk =
    header.length === expectedHeader.length &&
    header.every((h, i) => h === expectedHeader[i]);

  if (!headerOk) {
    throw new Error(
      `En-tête CSV inattendu. Attendu: ${expectedHeader.join(
        ";"
      )} mais trouvé: ${header.join(";")}`
    );
  }

  const rows: IngredientCsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const parts = line.split(";");

    if (parts.length < expectedHeader.length) {
      // Ligne incomplète : on l'ignore mais on log
      // eslint-disable-next-line no-console
      console.warn(`Ligne ${i + 1} ignorée (trop courte): ${line}`);
      continue;
    }

    const [
      ingredient_id,
      canonical_name,
      label_fr,
      category,
      default_unit,
      vegan,
      vegetarian,
      gluten_free,
      dairy_free,
      notes
    ] = parts.map((p) => p.trim());

    rows.push({
      ingredient_id,
      canonical_name,
      label_fr,
      category,
      default_unit,
      vegan,
      vegetarian,
      gluten_free,
      dairy_free,
      notes
    });
  }

  return rows;
}

function mapToDbRows(csvRows: IngredientCsvRow[]): IngredientDbRow[] {
  return csvRows.map((row) => ({
    canonical_name: row.canonical_name,
    display_name: row.label_fr,
    category: row.category,
    scientific_name: null,
    audio_key: null
  }));
}

async function upsertIngredients(dbRows: IngredientDbRow[]): Promise<void> {
  const BATCH_SIZE = 100;

  for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
    const batch = dbRows.slice(i, i + BATCH_SIZE);

    const { error } = await supabaseAdmin
      .from("ingredients_catalog")
      .upsert(batch, { onConflict: "canonical_name" });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erreur lors de l'upsert du batch:", error);
      throw error;
    }

    // eslint-disable-next-line no-console
    console.log(
      `Upsert batch ${Math.floor(i / BATCH_SIZE) + 1} : ${
        batch.length
      } lignes traitées`
    );
  }
}

async function main(): Promise<void> {
  const csvPathArg = process.argv[2];

  if (!csvPathArg) {
    // eslint-disable-next-line no-console
    console.error(
      "Usage: ts-node scripts/importIngredients.ts <chemin_du_csv>"
    );
    process.exit(1);
  }

  const csvPath = path.resolve(csvPathArg);
  // eslint-disable-next-line no-console
  console.log("Lecture du fichier CSV:", csvPath);

  const csvRows = await parseCsv(csvPath);
  // eslint-disable-next-line no-console
  console.log(
    `Lues ${csvRows.length} lignes d'ingrédients depuis le CSV.`
  );

  const dbRows = mapToDbRows(csvRows);
  await upsertIngredients(dbRows);

  // eslint-disable-next-line no-console
  console.log("Import/Upsert des ingrédients terminé.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Erreur fatale dans le script importIngredients:", err);
  process.exit(1);
});