# Backoffice Chefito – Admin premium recettes

Interface d’administration pour enrichir manuellement les recettes existantes avec une **qualité premium** : contenus éditoriaux avancés, concepts scientifiques, SEO, audio, embeddings RAG, gestion des doublons et des ingrédients.

Ce projet combine :

- Un backoffice historique minimal (pages router) pour certaines opérations.
- Un nouvel **espace admin premium en App Router** sous `/admin/*` optimisé pour l’enrichissement de recettes.

---

## 1. Stack & architecture

### 1.1. Technologies

- **Framework** : Next.js 15
  - Backoffice historique en **pages router** (`src/pages`)
  - Admin premium en **App Router** (`src/app/admin`)
- **Auth & données** : Supabase
  - Auth utilisateurs (email/mot de passe)
  - Tables métiers principales :  
    `recipes`, `ingredients_catalog`, `recipe_ingredients_normalized`,  
    `recipe_steps_enhanced`, `recipe_concepts`, `knowledge_base`,  
    `audio_library`, `audio_mapping`, `audio_usage_stats`,  
    `recipe_similarity_alerts`, `recipe_relationships`, `recipe_embeddings`, etc.
- **UI & formulaires**
  - Tailwind CSS, thème sombre
  - React Hook Form + Zod
  - React Query (`@tanstack/react-query`)
  - Tiptap (`@tiptap/react`) pour le texte riche des étapes

### 1.2. Authentification & rôles

- Auth Supabase gérée via un `AuthProvider` React (`src/hooks/useAuth.tsx`).
- Layout global `_app.tsx` (pages router) + layout `app/layout.tsx` (App Router).
- L’accès à `/admin/*` est réservé aux utilisateurs authentifiés avec un rôle `admin` (via la table `user_profiles` / `profiles`).

---

## 2. Définition d’une “recette premium”

Une recette est considérée **“premium”** si elle respecte l’ensemble des critères suivants (implémentés dans le code comme une fonction `getPremiumMissing(recipe)`):

1. **Publication**
   - `status = 'published'`

2. **Contenu de base**
   - `description` non vide
   - `image_url` non vide
   - `ingredients_text` non vide
   - `instructions_detailed` non vide

3. **Enrichissement éditorial**
   - `cultural_history` non vide
   - `techniques` non vide
   - `nutritional_notes` non vide

4. **SEO**
   - `meta_title` non vide
   - `meta_description` non vide

5. **Détails premium**
   - Au moins un des deux champs est non vide :
     - `chef_tips`
     - `difficulty_detailed`

6. **Noyau RAG**
   - Un embedding est présent pour la recette (`embedding` non nul)

Si **au moins un** de ces critères manque, la recette est considérée comme **“à enrichir”**.  
L’UI liste les critères manquants sous forme de badges (ex. _“Image”_, _“Notes nutritionnelles”_, _“Embedding RAG”_).

Cette logique est utilisée :

- Dans la **liste des recettes** (`/admin/recipes`) pour afficher les badges ✅/⚠️.
- Dans la **page d’édition** (`/admin/recipes/[id]/edit`) dans le panneau “Statut premium”.

---

## 3. Fonctionnalités de l’admin premium

### 3.1. Dashboard admin

#### `/admin/dashboard`

- Vue d’ensemble (via `src/lib/dashboard.ts`) :
  - Nombre total de recettes (`recipes`) et recettes avec vecteurs S3.
  - Nombre total d’articles (`posts`), articles enrichis et mis en cache.
  - Nombre total d’utilisateurs (`user_profiles`).
  - Indicateurs d’intégrations :
    - Stats Redis (`redis-wrapper`)
    - Stats S3 vecteurs (`s3-vectors-wrapper`)
    - Stats chiffrement Vault (`vault-wrapper`)
- Présentation en cartes “card” avec métriques et explications (RAG & intégrations).

---

### 3.2. Gestion des recettes – Mode premium

#### 3.2.1. Liste des recettes `/admin/recipes`

Affichage (via `src/app/admin/recipes/page.tsx`) :

- Données principales (`AdminRecipe`) issues de `recipes` :
  - `title`, `slug`, `status`, `description`, `image_url`
  - `category`, `cuisine`, `difficulty`
  - `ingredients_text`, `instructions_detailed`
  - `chef_tips`, `cultural_history`, `techniques`, `difficulty_detailed`, `nutritional_notes`
  - `meta_title`, `meta_description`
  - `embedding`

Fonctionnalités :

- **Filtres** :
  - `status` : `draft`, `scheduled`, `published`, ou “tous”
  - `difficulty` : `beginner`, `intermediate`, `advanced`, ou “toutes”
  - `category`, `cuisine` : listes des valeurs distinctes trouvées dans la base
- **Recherche plein texte** :
  - Sur `title`, `slug`, `category`, `cuisine`, `ingredients_text`, `instructions_detailed`
- **Qualité premium** :
  - Badge **✅ “enrichie”** si tous les critères premium sont remplis.
  - Badge **⚠️ “à enrichir”** sinon.
  - Badge rouge indiquant le nombre de champs manquants : `X champ(s) manquant(s)` (critères premium).
- **Embeddings** :
  - Colonne indiquant si l’embedding est présent (`Présent` / `Manquant`).
  - Bouton “Recalculer embedding” pour déclencher `generate-recipe-embedding`.

Actions :

- Lien vers la fiche d’édition premium :  
  `/admin/recipes/[id]/edit`
- Recalcul d’embedding via `triggerEmbedding("recipe", id)`.

---

#### 3.2.2. Édition d’une recette `/admin/recipes/[id]/edit`

Fichier principal : `src/app/admin/recipes/[id]/edit/page.tsx`.

##### a) Infos de base

- Champs :
  - `title`, `slug`
  - `description`
  - `category`, `cuisine`
  - `prep_time_min`, `cook_time_min`, `servings`
  - `difficulty` (`beginner`, `intermediate`, `advanced`)
  - `status` (`draft`, `scheduled`, `published`)
  - `publish_at` (datetime-local)
  - `tags` (via `TagInput`)

Validation :

- Zod (`recipeSchema` dans `src/types/forms.ts`) + React Hook Form.

##### b) Texte détaillé & enrichissement éditorial

- Champs :
  - `ingredients_text` (une ligne par ingrédient)
  - `instructions_detailed`
  - `chef_tips`
  - `cultural_history`
  - `techniques`
  - `source_info`
  - `difficulty_detailed`
  - `nutritional_notes`

##### c) Image & SEO

- Image :
  - `image_url`
  - Upload d’image vers Supabase Storage (bucket `recipe-images`) via `uploadRecipeImage` (`src/lib/storage.ts`):
    - chemin : `recipes/<slug>/<slug>-<timestamp>.<ext>`
- SEO :
  - `meta_title`
  - `meta_description`
  - `canonical_url`
  - `og_image_url`

##### d) Ingrédients structurés – `recipe_ingredients_normalized`

Composant : `src/components/admin/RecipeIngredientsEditor.tsx`.

Données :

- Table : `recipe_ingredients_normalized`
- `SELECT` avec join sur `ingredients_catalog` pour récupérer le label.

UI & fonctionnalités :

- Tableau éditable :
  - Ordre (`order_index`) avec drag & drop.
  - Ingrédient (via `IngredientSelector` → `ingredients_catalog`).
  - Quantité (`quantity` → `quantity_value`).
  - Unité (`unit` → `quantity_unit`).
  - Texte original (`original_text`).
  - Préparation (`preparation_notes`).
  - Optionnel (`is_optional`).
- Actions :
  - Ajouter une ligne.
  - Supprimer une ligne.
  - Sauvegarder :
    - Upsert des lignes valides (avec `recipe_id` + `order_index` recalculé).
    - Suppression des lignes supprimées.

##### e) Étapes enrichies – `recipe_steps_enhanced`

Composants :

- `StepEditor` (`src/components/admin/StepEditor.tsx`) – éditeur d’une étape.
- `RecipeStepsEditor` (`src/components/admin/RecipeStepsEditor.tsx`) – liste d’étapes.

Données :

- Table : `recipe_steps_enhanced`.
- Champs gérés :
  - `step_number`
  - `title`
  - `instruction` (HTML via Tiptap)
  - `estimated_duration`
  - `temperature_celsius`
  - `difficulty_level`
  - `scientific_explanation`

UI & fonctionnalités :

- Édition riche du texte de l’étape (Tiptap `StarterKit`).
- Ajout / suppression d’étapes.
- Réordonnancement (↑ / ↓) avec recalcul de `step_number`.
- Sauvegarde :
  - Suppression de toutes les anciennes étapes de la recette.
  - Insertion des nouvelles étapes ordonnées.

##### f) Panneau “Statut premium & actions rapides”

Dans la page d’édition, un panneau récapitule :

- **Statut premium** :
  - `recette premium` (si aucun critère manquant) ou
  - `à enrichir pour être premium` (liste des critères manquants).
- **Embedding RAG** :
  - Indication `Présent` / `Manquant` (via `recipe.embedding`).
  - Bouton “Générer / recalculer l’embedding”.
- **Concepts scientifiques** :
  - Nombre de concepts liés via `recipe_concepts`.
  - Bouton vers `/admin/knowledge` pour gérer `knowledge_base`.
- **Audio** :
  - Nombre d’entrées `audio_usage_stats` pour cette recette.
  - Bouton vers `/admin/audio` pour gérer `audio_library` et `audio_mapping`.

##### g) Actions globales sur la recette

- **Dupliquer** :
  - Création d’une nouvelle recette à partir de la recette actuelle (brouillon, slug suffixé).
  - Déclenchement d’un embedding pour la nouvelle recette.
- **Supprimer** :
  - Suppression de la recette (`DELETE FROM recipes WHERE id = ...`).
- **Retour à la liste** :
  - Redirection vers `/admin/recipes`.

---

### 3.3. Alertes de similarité & gestion des doublons

#### `/admin/alerts`

Données :

- Table : `recipe_similarity_alerts`.
- Jointure sur `recipes` pour afficher la nouvelle recette et la recette similaire.

Fonctionnalités :

- Liste des alertes en `status IN ('pending', 'reviewing')`.
- Pour chaque alerte :
  - Score de similarité, date de création.
  - Nouveau vs similaire (titre, slug, liens vers fiches d’édition).

Actions :

1. **Marquer comme variantes parent/enfant**
   - Insère dans `recipe_relationships` (`relationship_type = 'variant'`).
   - Met à jour l’alerte :
     - `status = 'resolved'`
     - `resolution = 'parent_child'`.

2. **Marquer comme différentes (rejeter)**
   - `status = 'resolved'`
   - `resolution = 'different'`.

3. **Fusionner les doublons**
   - Appelle `POST /api/recipes/merge` (route App Router) avec client Supabase service role (`supabaseAdmin`).
   - Re-pointe les tables dépendantes vers la recette canonique :
     - `recipe_embeddings`
     - `recipe_ingredients_normalized`
     - `recipe_steps_enhanced`
     - `recipe_concepts`
     - `audio_usage_stats`
   - Ajuste `recipe_relationships` :
     - Remplace les références `duplicateId` par `canonicalId`.
     - Supprime les relations devenues incohérentes (auto-références).
   - Marque la recette dupliquée :
     - `status = 'draft'`
     - `slug` modifié (suffixe `-fusionnee`)
     - Ajout d’une note de fusion dans `source_info`.
   - Met à jour l’alerte :
     - `status = 'resolved'`
     - `resolution = 'merged'`.

L’UI propose :

- “Fusionner (garder la recette existante)”
- “Fusionner (garder la nouvelle)”

---

### 3.4. Bibliothèque d’ingrédients

#### `/admin/ingredients`

Données :

- Table : `ingredients_catalog`.

Fonctionnalités :

- Liste :
  - `display_name`, `canonical_name`, `category`, `scientific_name`
  - `audio_key`, `usage_count`
- Formulaire CRUD :
  - Création d’un nouvel ingrédient.
  - Édition / suppression d’un ingrédient existant.

Utilisation :

- L’éditeur `RecipeIngredientsEditor` s’appuie sur `ingredients_catalog` pour l’autocomplete.

---

### 3.5. Knowledge base (concepts scientifiques)

#### `/admin/knowledge`

Données :

- Table : `knowledge_base`.

Fonctionnalités :

- Liste des concepts :
  - `concept_key`, `title`, `category`
  - `difficulty_level`, `work_status`, `usage_priority`
- Vision globale de l’état d’avancement :
  - Workflow `work_status` : `not_started`, `researching`, `draft`, `ready`, `published`.
- Liens avec les recettes via `recipe_concepts` (compteur dans l’éditeur).

---

### 3.6. Gestion audio

#### `/admin/audio`

Données :

- Tables : `audio_library`, `audio_mapping`.

##### a) Bibliothèque audio (`audio_library`)

- Affichage :
  - `audio_key`, `audio_url`
  - `audio_type` (`action`, `concept`, `intro`, `tip`, etc.)
  - `language`
  - `voice_style`
  - `quality_tier`
  - `production_status`
  - `audio_duration_seconds`

##### b) Upload de fichiers audio

- Upload d’un fichier `audio/*` via `uploadAudioFile` (bucket `audio-files`) :
  - Chemin : `audio/<audioKey>/<audioKey>-<timestamp>.<ext>`
- Création automatique d’une entrée `audio_library` avec :
  - `audio_key`, `audio_url`
  - `audio_type`, `language`, `voice_style`, `quality_tier`
  - `production_status = 'ready'` (par défaut)

##### c) Mapping audio ↔ contenu (`audio_mapping`)

- Formulaire de création de mapping :
  - `concept_key` (clé fonctionnelle, ex : `ingredient:tomate`, `concept:maillard`).
  - `content_type` (`ingredient`, `concept`, `action`, `step`).
  - `audio_library_id` (sélection dans la bibliothèque audio).
- Tableau des mappings existants :
  - Clé de contenu (`concept_key`)
  - Type (`content_type`)
  - Audio associé (`audio_key` si trouvé, sinon `audio_library_id`).

##### d) Usage audio par recette

- Table `audio_usage_stats` :
  - Traque les usages audio dans les recettes.
- Dans l’éditeur de recette :
  - Le panneau d’actions rapides affiche le nombre d’usages audio liés à la recette.

---

## 4. Partie historique : back-office HTML minimal

Historique : ce repo contenait initialement un **back-office Supabase minimal** via un simple `index.html` statique (sans Next.js), décrit dans l’ancienne version du `readme`.  
Cette interface est aujourd’hui suppléée par le nouvel admin Next.js 15 / Supabase décrit ci-dessus.

Si tu veux conserver cette interface minimaliste pour du debug ponctuel, tu peux :

- Garder `index.html` tel quel comme outil de back-office “brut”.
- Adapter les `TABLE_CONFIG` pour les tables actuelles.
- Le servir en statique (Python `http.server`, `npx serve`, Netlify, Vercel, etc.).

---

## 5. Résumé opérationnel

En pratique, le backoffice te permet aujourd’hui :

- De **lister et filtrer** les recettes et voir immédiatement lesquelles sont au niveau “premium”.
- D’**éditer en profondeur** une recette :
  - base éditoriale,
  - ingrédients texte + ingrédients normalisés,
  - étapes enrichies (Tiptap, durées, température, explications scientifiques),
  - SEO,
  - image,
  - statut et publication.
- De **piloter la qualité premium** via une définition claire et visible dans l’UI.
- De **gérer les alertes de similarité** :
  - marquage parent/enfant,
  - rejet,
  - **fusion avancée** des doublons avec migration des données liées.
- De **maintenir un catalogue d’ingrédients** centralisé.
- De **gérer une base de connaissances scientifiques** (`knowledge_base`) et leurs liens à des recettes.
- De **gérer une bibliothèque audio** :
  - upload de fichiers audio,
  - métadonnées,
  - mappings vers des ingrédients / concepts / actions,
  - suivi des usages audio par recette.

Cette doc reflète l’état fonctionnel actuel du projet.  
Tu peux t’y référer pour continuer à enrichir l’admin (par exemple : CRUD complet sur `knowledge_base`, workflows de travail `work_progress`, analytics audio plus poussés, etc.).
