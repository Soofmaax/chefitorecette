# Guide interne Chefito – Import de recettes à partir d’un texte brut

## Objectif

Expliquer comment **rédiger / structurer le texte d’une recette** pour que l’admin Chefito puisse :

- pré-remplir automatiquement un maximum de champs (titre, temps, portions, description, conservation, labels, etc.) ;
- structurer les données (ingrédients normalisés, étapes enrichies, concepts, ustensiles) ;
- le tout **sans IA payante**, uniquement avec des règles de parsing.

Ce guide est pour la personne qui prépare les textes avant de les coller dans l’admin.

---

## 1. Vue d’ensemble du flux

Pour chaque recette :

1. Tu rédiges un **texte complet de recette** (Notion, Google Docs, Trello, etc.) en suivant quelques conventions simples.
2. Dans l’admin Chefito :

   - tu vas sur `/admin/recipes/create` ou `/admin/recipes/[id]/edit` ;
   - tu colles ce texte dans **“0. Import depuis un texte brut”** ;
   - tu cliques sur **“Pré-remplir depuis le texte”**.

3. L’admin remplit automatiquement :

   - les champs de base (titre, portions, difficulté, temps) ;
   - la description, les ingrédients texte, les instructions détaillées ;
   - la conservation, les labels alimentaires, les températures de service, etc.

4. En édition, tu peux ensuite cliquer sur :

   - **“Pré-remplir ingrédients / étapes / concepts”** pour générer :
     - les ingrédients normalisés ;
     - les étapes enrichies ;
     - les concepts scientifiques liés.

5. Tu vérifies/corriges, puis tu publies.

---

## 2. Format recommandé pour le texte de recette

Plus tu suis ce format, plus l’auto‑remplissage est bon.

### 2.1. En‑tête

Première ligne :

- éventuellement un emoji “plat” (🥗, 🍲, 🍰…) ;
- le **titre** ;
- le nombre de personnes entre parenthèses.

```text
🥗 Patate douce en salade, citron confit (4 personnes)
```

Le système en déduit :

- `title = "Patate douce en salade, citron confit"` ;
- `servings = 4`.

---

### 2.2. Bloc “Petite histoire” (description / contexte)

Titre contenant `Petite histoire` :

```text
📖 Petite histoire

Ici, tu racontes en quelques phrases l’origine, le contexte ou
l’intention de la recette.
```

Ce bloc sert à alimenter :

- la **description** (`description`) ;
- l’**histoire / contexte culturel** (`cultural_history`).

---

### 2.3. Bloc “Difficulté & temps”

Bloc compact :

```text
⭐ Difficulté : Facile
⏱ Préparation : 25 minutes
🔥 Cuisson : 20 à 30 minutes
```

Le système en déduit :

- `difficulty = "beginner"` (Facile) ;
- `prep_time_min = 25` ;
- `cook_time_min = 25` (moyenne de 20–30).

Pour le temps de repos :

```text
⏳ Repos : 10 minutes
```

ou une phrase :

```text
Laisser reposer 10 minutes avant de servir.
```

→ `rest_time_min = 10`.

---

### 2.4. Bloc “Ingrédients”

Titre contenant `Ingrédients` :

```text
🧾 Ingrédients

600 g patate douce
1 citron confit
1 oignon rouge
50 g noix ou cacahuètes
1 petit bouquet coriandre
2 c.à.s huile d’olive
Sel, poivre
Option vegan : remplacer le miel par du sirop d’érable.
```

Règles :

- **une ligne par ingrédient** ;
- quantité au début quand possible (`600 g`, `1`, `1/2`…) ;
- les lignes qui commencent par `Option` ne sont **pas** traitées comme des ingrédients principaux :
  - elles alimentent `chef_tips` (astuces/options), pas la liste de base.

Utilisé pour :

- `ingredients_text` brut ;
- puis, via **“Pré‑remplir ingrédients / étapes / concepts”**, création des lignes `recipe_ingredients_normalized` (quantité, unité, lien au catalogue).

---

### 2.5. Bloc “Préparation pas à pas”

Titre contenant `Préparation` :

```text
👩‍🍳 Préparation pas à pas

1. Préchauffer le four à 200 °C.
2. Éplucher et couper la patate douce en cubes.
3. Mélanger avec l’huile, le sel, le poivre.
4. Enfourner 20 à 30 minutes en remuant à mi-cuisson.
5. ...
```

Le parseur :

- supprime les numéros (`1.`, `2)`, etc.) et les emojis au début des lignes ;
- produit un bloc `instructions_detailed` (un paragraphe par étape).

La fonction **“Pré‑remplir ingrédients / étapes / concepts”** découpe ensuite ce texte en `recipe_steps_enhanced` (une étape par ligne structurée).

Tu peux aussi utiliser des paragraphes séparés par une ligne vide à la place de `1.`, `2.`, etc.

---

### 2.6. Bloc “Conservation & Meal Prep”

Titre contenant `Conservation` :

```text
🧊 Conservation & Meal Prep

Se conserve 2 jours au réfrigérateur dans une boîte hermétique.
À déguster tiède ou à température ambiante.
```

Le système remplit :

- `storage_instructions` (texte du bloc) ;
- `storage_duration_days = 2` (si “2 jours”, “2 j”, “48 h”… converti en jours) ;
- `storage_modes` :
  - `refrigerateur` (si frigo/réfrigérateur) ;
  - `boite_hermetique` (si boîte hermétique / tupperware) ;
  - `congelateur` (si congélation) ;
  - etc. ;
- `serving_temperatures` :
  - `tiede` (si “servir tiède”) ;
  - `ambiante` (si “température ambiante”) ;
  - `froid` (si “servir froid / bien frais”), etc.

---

### 2.7. Astuces / options / tips

Les “options” et “astuces” alimentent `chef_tips` :

```text
💡 Astuces

Option plus épicée : ajouter un deuxième piment.
Option vegan : remplacer le miel par du sirop d’érable.
Option sans gluten : vérifier que la moutarde est certifiée sans gluten.
```

Toutes ces lignes sont concaténées dans les astuces de la fiche recette.

---

### 2.8. Anecdote / histoire supplémentaire

En plus de “Petite histoire”, tu peux ajouter :

```text
👻 Anecdote

Cette salade est née lors d’un repas improvisé avec des restes de légumes rôtis...
```

Le texte de `Petite histoire` + `Anecdote` est fusionné dans `cultural_history`.

---

### 2.9. Notes techniques / nutritionnelles

Sections optionnelles recommandées :

```text
🧪 Techniques

Parler ici des techniques de cuisine, gestes, organisation…

🍏 Notes nutrition

Parler ici des points nutritionnels, substitutions, etc.
```

Elles alimentent respectivement :

- `techniques` ;
- `nutritional_notes`.

---

### 2.10. Source & tags

Source :

```text
📚 Source : Adaptation d’une recette de Jamie Oliver.
```

→ `source_info`.

Tags Trello / éditoriaux :

```text
🏷 Tag Trello : Salades & Entrées
```

→ `tags = ["Salades & Entrées"]`.

---

## 3. Labels alimentaires (vegan, sans gluten, etc.)

Le parseur détecte certains labels directement dans le texte :

- `vegan` → `vegan` ;
- `végétalien` / `vegetalien` → `vegetalien` ;
- `végétarien` / `vegetarien` → `vegetarien` ;
- `pescetarien` → `pescetarien` ;
- `sans gluten` → `sans_gluten` ;
- `sans lactose` → `sans_lactose` ;
- `sans œuf` / `sans oeuf` → `sans_oeuf` ;
- `sans arachide` → `sans_arachide` ;
- `sans fruits à coque` → `sans_fruits_a_coque` ;
- `sans soja` → `sans_soja` ;
- `sans sucre ajouté` → `sans_sucre_ajoute` ;
- `sans sel ajouté` → `sans_sel_ajoute` ;
- `halal` → `halal` ;
- `casher` / `kasher` → `casher`.

**Conseil** : si tu veux qu’un label soit coché, écris‑le clairement une fois dans le texte (souvent dans le bloc Astuces ou en bas de recette).

---

## 4. Ustensiles

Section recommandée :

```text
🔧 Ustensiles nécessaires

1 couteau économe
1 planche à découper
1 plaque de cuisson
1 four
1 saladier
1 poêle
```

Le parseur :

- enlève les nombres (`1`, `2`, etc.) ;
- garde le label (couteau économe, etc.) ;
- essaie de matcher chaque label avec `utensils_catalog` ;
- coche les ustensiles correspondants dans l’admin.

---

## 5. Exemple complet de texte Chefito

```text
🥗 Patate douce en salade, citron confit (4 personnes)

📖 Petite histoire

Une salade tiède de patate douce rôtie, citron confit et herbes fraîches, idéale
pour un repas léger mais rassasiant. Inspirée d’un voyage au Maroc, elle se
sert aussi bien en entrée qu’en plat principal avec un peu de protéines.

⭐ Difficulté : Facile
⏱ Préparation : 25 minutes
🔥 Cuisson : 20 à 30 minutes
⏳ Repos : 10 minutes

🧾 Ingrédients

600 g patate douce
1 citron confit
1 oignon rouge
50 g noix ou cacahuètes
1 petit bouquet coriandre
1 petit bouquet persil
2 c.à.s huile d’olive
Sel, poivre
1 piment frais (facultatif)
Option vegan : remplacer le miel par du sirop d’érable.
Option sans gluten : vérifier que la moutarde est certifiée sans gluten.

🔧 Ustensiles nécessaires

1 couteau économe
1 planche à découper
1 plaque de cuisson
1 four
1 saladier
1 poêle

👩‍🍳 Préparation pas à pas

1. Préchauffer le four à 200 °C.
2. Éplucher et couper la patate douce en cubes.
3. Mélanger avec l’huile d’olive, le sel et le poivre. Étaler sur la plaque.
4. Enfourner 20 à 30 minutes en remuant à mi-cuisson.
5. Pendant ce temps, émincer l’oignon rouge, hacher les herbes et le piment.
6. Hacher grossièrement les noix ou cacahuètes.
7. Dans un saladier, mélanger le citron confit en petits dés, l’oignon, les herbes, les noix.
8. Ajouter la patate douce tiède, rectifier l’assaisonnement et servir.

🧊 Conservation & Meal Prep

Se conserve 2 jours au réfrigérateur dans une boîte hermétique.
À déguster tiède ou à température ambiante.
Option meal prep : cuire la patate douce la veille et assembler au dernier moment.

💡 Astuces

Option plus épicée : ajouter un deuxième piment.
Option vegan : remplacer le miel par du sirop d’érable.
Option sans gluten : vérifier que la moutarde est certifiée sans gluten.

👻 Anecdote

Cette salade est née lors d’un repas improvisé avec des restes de légumes rôtis,
et est devenue un classique des brunchs du week-end.

🏷 Tag Trello : Salades & Entrées

📚 Source : Adaptation d’une recette de Jamie Oliver.
```

En collant ce texte dans l’admin, puis en cliquant sur :

1. **“Pré‑remplir depuis le texte”**, puis  
2. **“Pré‑remplir ingrédients / étapes / concepts”** (sur la page d’édition),

tu obtiens une fiche recette largement remplie, qu’il ne reste qu’à corriger et affiner.

---

## 6. Résumé rapide à garder en tête

1. **Titre + (X personnes)** sur la première ligne.
2. Sections conseillées (dans l’ordre) :
   - `Petite histoire` ;
   - `Difficulté / Temps` ;
   - `Ingrédients` ;
   - `Ustensiles` ;
   - `Préparation` ;
   - `Conservation & Meal Prep` ;
   - `Astuces` ;
   - `Anecdote` ;
   - `Techniques` / `Notes nutrition` ;
   - `Tag Trello` ;
   - `Source`.
3. **Une ligne par ingrédient**, quantité au début si possible.
4. Écrire explicitement `vegan`, `sans gluten`, etc. pour les labels.
5. Utiliser des formulations simples pour les temps :
   - `Préparation : 25 minutes`, `Cuisson : 20 à 30 minutes`, `Se conserve 2 jours…`.

Avec ces conventions, tu colles ton texte, tu cliques sur les boutons de pré‑remplissage, et l’admin fait 80–90 % du travail pour toi.