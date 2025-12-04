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

> Remarque : la présence d’un **embedding RAG** n’est **pas** un critère de “recette premium”.  
> C’est une information technique complémentaire (affichée dans l’UI) qui peut être mise à jour à la demande, mais la qualité premium reste un jugement éditorial / SEO.

Si **au moins un** de ces critères manque, la recette est considérée comme **“à enrichir”**.  
L’UI liste les critères manquants sous forme de badges (ex. _“Image”_, _“Notes nutritionnelles”_, _“Titre SEO”_).

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
  - `embedding` (optionnel, indicateur technique)

Fonctionnalités :

- **Filtres** :
  - `status` : `draft`, `scheduled`, `published`, ou “tous”
  - `difficulty` : `beginner`, `intermediate`, `advanced`, ou “toutes”
  - `category`, `cuisine` : listes des valeurs distinctes trouvées dans la base
  - **Filtre RAG** (structure de données) :
    - `RAG complet` : ingrédients normalisés, étapes enrichies, concepts liés et SEO (titre + meta description) présents.
    - `RAG partiel` : certaines dimensions remplies, d’autres non.
    - `RAG absent` : aucune de ces dimensions n’est renseignée.
    - Filtres dimensionnels :
      - `Sans ingrédients normalisés` (aucune entrée dans `recipe_ingredients_normalized`),
      - `Sans étapes enrichies` (aucune entrée dans `recipe_steps_enhanced`),
      - `Sans concepts scientifiques` (aucune entrée dans `recipe_concepts`).
- **Recherche** :
  - Recherche plein texte :
    - Sur `title`, `slug`, `category`, `cuisine`, `ingredients_text`, `instructions_detailed`
  - Recherche ciblée :
    - Champ dédié pour saisir un **ID** ou un **slug exact** et accéder directement à une recette précise.
- **Pagination côté base** :
  - Pages de 50 recettes (configurable),
  - Tri par `created_at` (les plus récentes en premier),
  - Affichage du nombre total de recettes correspondant aux filtres.
- **Qualité premium** :
  - Badge **✅ “enrichie”** si tous les critères premium (éditoriaux/SEO) sont remplis.
  - Badge **⚠️ “à enrichir”** sinon.
  - Badge rouge indiquant le nombre de champs manquants : `X champ(s) manquant(s)` (critères premium).
- **Colonne RAG** :
  - Badge **“RAG complet / partiel / absent”** calculé côté front à partir de :
    - la présence d’ingrédients normalisés,
    - d’étapes enrichies,
    - de concepts scientifiques liés,
    - et de champs SEO (`meta_title`, `meta_description`).
  - Sert à piloter la complétude de la structure de données pour le futur RAG, indépendamment du statut premium.
- **Embeddings** :
  - Colonne indiquant si l’embedding est présent (`Présent` / `Manquant`).
  - Bouton “Recalculer embedding” pour déclencher `generate-recipe-embedding` (usage optionnel).

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
- Assistants de saisie :
  - `difficulty_detailed` peut être prérempli automatiquement à partir de `difficulty` grâce à des templates texte (débutant/intermédiaire/avancé), modifiables à la main.

##### c) Image & SEO

- Image :
  - `image_url`
  - Upload d’image vers Supabase Storage (bucket `recipe-images`) via `uploadRecipeImage` (`src/lib/storage.ts`):
    - chemin : `recipes/&lt;slug&gt;/&lt;slug&gt;-&lt;timestamp&gt;.&lt;ext&gt;`
- SEO :
  - `meta_title`
  - `meta_description`
  - `canonical_url`
  - `og_image_url`
- Assistants de saisie (sans IA) :
  - `meta_title` prérempli automatiquement à partir du `title` (si vide).
  - `meta_description` préremplie à partir de `description`, tronquée à ~160 caractères (si vide).
  - `canonical_url` préremplie à partir du `slug` (pattern `/recettes/{slug}`) si vide.
  - `og_image_url` préremplie à partir de `image_url` si vide.

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
  - Unité (`unit` → `quantity_unit`) :
    - champ texte avec liste d’unités courantes (g, kg, ml, c.à.s, c.à.c, pincée, etc.) pour éviter les incohérences, tout en restant modifiable.
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
- **Embedding RAG** (facultatif) :
  - Indication `Présent` / `Manquant` (via `recipe.embedding`).
  - Bouton “Générer / recalculer l’embedding”.
  - L’embedding n’influence pas le statut premium, il sert uniquement à la recherche/RAG.
- **Concepts scientifiques** :
  - Nombre de concepts liés via `recipe_concepts`.
  - Bouton vers `/admin/knowledge` pour gérer `knowledge_base`.
- **Audio** :
  - Nombre d’entrées `audio_usage_stats` pour cette recette.
  - Bouton vers `/admin/audio` pour gérer `audio_library` et `audio_mapping`.
- **Checklist RAG (structure)** :
  - Ingrédients normalisés présents ou non (`recipe_ingredients_normalized`).
  - Étapes enrichies présentes ou non (`recipe_steps_enhanced`).
  - Concepts scientifiques liés présents ou non (`recipe_concepts`).
  - SEO complet ou non (titre + meta description).
  - Permet de voir immédiatement si la recette est “RAG-ready” côté données, indépendamment du statut premium.

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

Champs principaux :

- Métadonnées :
  - `concept_key` (clé unique interne, ex. `reaction_maillard`)
  - `title` (ex. “Réaction de Maillard”)
  - `category` (thermodynamique, chimie, texture…)
  - `difficulty_level` (1–3)
  - `work_status` (`not_started`, `researching`, `draft`, `ready`, `published`)
  - `usage_priority` (priorité d’usage dans l’UI et le RAG)
- Contenus de connaissance :
  - `short_definition` : définition courte (résumé en 1–2 phrases)
  - `long_explanation` : explication détaillée, exemples…
  - `synonyms` : liste de synonymes (array texte)

Fonctionnalités :

- Formulaire CRUD complet :
  - Création d’un concept avec toutes les métadonnées et contenus de connaissance.
  - Édition d’un concept existant (bouton “Éditer” dans la liste).
  - Suppression d’un concept, avec confirmation.
- Saisie assistée :
  - Les synonymes sont saisis sous forme de texte séparé par des virgules, puis transformés en array pour `synonyms`.
- Vision globale de l’état d’avancement :
  - Workflow `work_status` : `not_started`, `researching`, `draft`, `ready`, `published`.
- Liens avec les recettes via `recipe_concepts` (affichage dans l’éditeur de recette et dans le panneau RAG).

---

### 3.6. Concepts scientifiques liés à une recette

#### Éditeur de concepts par recette

Composant : `src/components/admin/RecipeConceptsEditor.tsx`, intégré dans la page d’édition d’une recette.

Données :

- Tables :
  - `knowledge_base` (concepts)
  - `recipe_concepts` (liens recette ↔ concepts)

Fonctionnalités :

- Visualisation :
  - Liste des concepts déjà liés à la recette sous forme de “chips” (titre + `concept_key`).
  - Bouton ✕ pour retirer un concept (supprime l’entrée correspondante dans `recipe_concepts`).
- Ajout de concepts :
  - Champ de recherche plein texte (titre, `concept_key`, catégorie, statut).
  - Suggestions limitées aux concepts non encore liés à la recette.
  - Bouton “Ajouter” qui crée un lien dans `recipe_concepts` (`recipe_id` + `concept_key`).
- Cette édition permet de remplir la table `recipe_concepts` de manière fluide et de renforcer le contexte scientifique pour chaque recette.

---

### 3.7. Gestion audio

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

- De **lister et filtrer** les recettes à grande échelle (pagination serveur) et voir immédiatement lesquelles sont au niveau “premium”.
- De **retrouver instantanément** une recette précise via un champ de recherche par **ID ou slug exact**.
- De **piloter la structure RAG** des recettes grâce :
  - à une colonne **RAG** (complet / partiel / absent),
  - à des filtres dédiés (recettes sans ingrédients normalisés, sans étapes enrichies, sans concepts scientifiques).
- D’**éditer en profondeur** une recette :
  - base éditoriale,
  - ingrédients texte + ingrédients normalisés,
  - étapes enrichies (Tiptap, durées, température, explications scientifiques),
  - SEO (avec auto-remplissage basique du titre et de la meta description),
  - image,
  - statut et publication.
- De **piloter la qualité premium** via une définition claire et visible dans l’UI, indépendante de l’IA.
- De **gérer les alertes de similarité** :
  - marquage parent/enfant,
  - rejet,
  - **fusion avancée** des doublons avec migration des données liées.
- De **maintenir un catalogue d’ingrédients** centralisé.
- De **gérer une base de connaissances scientifiques** (`knowledge_base`) enrichie :
  - métadonnées (statut, difficulté, priorité),
  - contenu (définition courte, explication longue, synonymes),
  - liens avec les recettes (`recipe_concepts`) éditables directement depuis l’éditeur de recette.
- De **gérer une bibliothèque audio** :
  - upload de fichiers audio,
  - métadonnées,
  - mappings vers des ingrédients / concepts / actions,
  - suivi des usages audio par recette.
- D’**exploiter les embeddings** comme couche technique optionnelle (RAG/recherche) sans qu’ils bloquent le statut premium.

Cette doc reflète l’état fonctionnel actuel du projet.  
Tu peux t’y référer pour continuer à enrichir l’admin (par exemple : analytics RAG plus poussés dans le dashboard, vues SQL pour les recettes à compléter, etc.).

---

## 6. Architecture – vue d’ensemble

### 6.1. Diagramme logique (texte)

```text
[Client Web (Next 15)]
   |
   |  (Auth, appels React Query)
   v
[Supabase auth] -----> [user_profiles / profiles]
   |
   |  (clients Supabase)
   v
[Supabase Postgres]
   |   \
   |    \-- tables recettes : recipes, recipe_ingredients_normalized,
   |         recipe_steps_enhanced, recipe_concepts, recipe_embeddings...
   |
   |-- [knowledge_base] (concepts scientifiques)
   |-- [ingredients_catalog] + [recipe_ingredients_normalized]
   |-- [audio_library] + [audio_mapping] + [audio_usage_stats]
   |-- [recipe_similarity_alerts] + [recipe_relationships]
   |
   |-- Edge functions :
        - generate-recipe-embedding
        - generate-post-embedding
        - redis-wrapper
        - s3-vectors-wrapper
        - vault-wrapper
```

### 6.2. Clients Supabase

- **Client navigateur** (`supabaseClient`) :
  - Utilise `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Sert à toutes les opérations côté client sécurisées par RLS (lecture, updates simples).
- **Client admin serveur** (`supabaseAdmin`) :
  - Utilise `SUPABASE_SERVICE_ROLE_KEY`.
  - Uniquement dans les routes `/app/api/*` (ex. fusion de recettes).
  - Permet des opérations globales (migration de données entre recettes), tout en vérifiant côté route que l’utilisateur connecté a bien le rôle admin.

---

## 6.3. CI / qualité code

- **GitHub Actions** :
  - Workflow `CI` dans `.github/workflows/ci.yml`.
  - Se déclenche sur `push` (branches principales) et `pull_request`.
  - Étapes :
    - `npm install`
    - `npm run lint`
    - `npm run typecheck`
    - `npm run build`
- **Scripts npm** utiles :
  - `npm run dev` : dev server Next.
  - `npm run lint` : ESLint (Next).
  - `npm run typecheck` : TypeScript sans émission.
  - `npm run build` : build Next (vérifie aussi les erreurs runtime côté compilation).

---

## 6.4. SQL pour scaler et enrichir les données

### 6.4.1. Index pour les recettes

Un fichier `sql/indexes_recipes.sql` propose une série d’indexes à appliquer dans Supabase pour garder une bonne performance quand le nombre de recettes augmente :

- Index sur les colonnes de filtre :
  - `status`, `difficulty`, `category`, `cuisine`
- Index sur les colonnes d’accès direct :
  - `slug`, `created_at`

Utilisation :

1. Ouvrir le **SQL editor** dans Supabase.
2. Coller le contenu de `sql/indexes_recipes.sql`.
3. Exécuter les commandes (`create index if not exists …`).

Une suggestion de mise en place d’un index full-text (`tsvector` + index GIN) est aussi fournie en commentaire pour aller plus loin sur la recherche sémantique.

### 6.4.2. Enrichissement de la base de connaissances

Un fichier `sql/knowledge_base_enrich.sql` ajoute des colonnes utiles au RAG dans la table `knowledge_base` :

- `short_definition` (texte)
- `long_explanation` (texte)
- `synonyms` (tableau de textes)

Utilisation :

1. Ouvrir le **SQL editor** dans Supabase.
2. Coller le contenu de `sql/knowledge_base_enrich.sql`.
3. Exécuter les commandes (`alter table … add column if not exists …`).

Ces colonnes sont utilisées par la page `/admin/knowledge` pour saisir des définitions courtes, des explications longues et des synonymes pour chaque concept scientifique.

---

## 7. Guide de prise en main en 5 minutes (par rôle)

### 7.1. Rédacteur / éditorial

Objectif : enrichir des recettes pour les passer au niveau “premium”.

1. **Se connecter**
   - Aller sur `/auth/sign-in`.
   - Se connecter avec un compte ayant accès à l’admin (rôle `editor` ou `admin` selon tes règles).

2. **Lister les recettes**
   - Menu : **Recettes** → `/admin/recipes`.
   - Utiliser les filtres (statut, difficulté, catégorie, cuisine) pour trouver une recette.
   - Repérer les badges :
     - ✅ `enrichie` = recette premium.
     - ⚠️ `à enrichir` = encore du travail.

3. **Ouvrir une recette à compléter**
   - Cliquer sur le titre pour ouvrir `/admin/recipes/[id]/edit`.
   - En haut, regarder le panneau “Statut premium & actions rapides” :
     - S’il y a des badges rouges, ce sont les critères manquants.

4. **Compléter les contenus**
   - Renseigner/compléter :
     - `description`, `ingredients_text`, `instructions_detailed`.
     - `cultural_history`, `techniques`, `nutritional_notes`.
     - `chef_tips` ou `difficulty_detailed`.
     - SEO : `meta_title`, `meta_description`.
   - Mettre à jour l’image si besoin (`image_url` ou upload).

5. **Enregistrer & vérifier**
   - Cliquer sur “Mettre à jour la recette”.
   - Regarder à nouveau le panneau “Statut premium” :
     - Si tous les critères sont remplis, la recette passe en “recette premium”.
   - Si besoin, demander à un admin de déclencher l’embedding (ou utiliser le bouton si accessible).

---

### 7.2. Admin produit / chef de projet

Objectif : piloter la qualité globale et la cohérence du catalogue.

1. **Surveiller les métriques globales**
   - Aller sur `/admin/dashboard`.
   - Vérifier :
     - Nombre de recettes, articles, utilisateurs.
     - Intégrations RAG (Redis, S3, Vault).

2. **Suivre l’enrichissement des recettes**
   - `/admin/recipes` :
     - Utiliser les filtres pour voir :
       - Recettes publiées mais pas encore premium.
       - Recettes par catégorie/cuisine/difficulté.
     - Prioriser les recettes avec beaucoup de champs manquants.

3. **Gérer les doublons**
   - `/admin/alerts` :
     - Voir les alertes de similarité.
     - Pour chaque alerte :
       - Marquer parent/enfant quand il s’agit de variantes.
       - Rejeter les faux positifs.
       - Utiliser la fusion pour éliminer les doublons et centraliser les stats.

4. **Maintenir les ingrédients et la base de connaissances**
   - `/admin/ingredients` :
     - Ajouter des ingrédients manquants.
     - Harmoniser les noms (display vs canonical).
   - `/admin/knowledge` :
     - Vérifier les concepts importants.
     - S’assurer que les recettes importants ont des concepts associés.

5. **Piloter la partie audio**
   - `/admin/audio` :
     - Vérifier quels audios existent (intros, concepts, actions).
     - Créer des mappings pour associer les bons audios aux bons concepts ou ingrédients.
     - Vérifier l’usage audio par recette depuis le panneau d’édition.

---

### 7.3. Data / ML / intégrations

Objectif : utiliser le backoffice comme point de contrôle et d’observation des données pour RAG, embedding, audio, etc.

1. **Vérifier l’état des embeddings**
   - `/admin/recipes` :
     - Colonne “Embedding” pour repérer les recettes sans vecteur.
     - Le statut premium reste indépendant de l’IA (uniquement éditorial/SEO).
   - `/admin/recipes/[id]/edit` :
     - Utiliser le bouton “Générer / recalculer l’embedding” pour forcer un refresh.
   - Vérifier les Edge functions (`generate-recipe-embedding`, `redis-wrapper`, `s3-vectors-wrapper`, `vault-wrapper`).

2. **Observer la qualité des données structurées**
   - `recipe_ingredients_normalized` :
     - Via `/admin/recipes/[id]/edit` → bloc “Ingrédients structurés”.
     - Vérifier que les ingrédients sont bien liés au catalogue (`ingredients_catalog`).
   - `recipe_steps_enhanced` :
     - Vérifier que les étapes contiennent du texte riche exploitable pour les embeddings.

3. **Utiliser la knowledge base**
   - `/admin/knowledge` :
     - Voir quels concepts sont prêts (`work_status = 'ready' / 'published'`).
     - Vérifier les liens `recipe_concepts` avec les recettes clés.

4. **Suivre et enrichir l’audio**
   - `/admin/audio` :
     - Vérifier l’exhaustivité de `audio_library`.
     - Créer de nouveaux audios (upload) pour les concepts importants.
     - Mapper les audios avec `audio_mapping` pour les ingrédients, concepts, actions.
   - Depuis `/admin/recipes/[id]/edit` :
     - Consulter le nombre d’usages audio (`audio_usage_stats`) pour chaque recette.

5. **Travailler sur les similitudes et la cohérence du catalogue**
   - `/admin/alerts` :
     - Utiliser les alertes de similarité comme feedback sur la qualité des embeddings.
     - Après fusion, vérifier que les tables liées (`recipe_embeddings`, `audio_usage_stats`, etc.) pointent vers la recette canonique.

---

Avec ces sections supplémentaires (architecture + guides par rôle), tu as une vue complète pour ne pas te perdre :

- **Quoi fait quoi** (architecture + tables).
- **Qui fait quoi** (rédacteur, admin, data).
- **Où cliquer** dans le backoffice pour chaque type de tâche.

Si tu veux, on peut ensuite ajouter une mini “checklist de mise en prod” (variables d’environnement, buckets storage, politiques RLS) pour fermer la boucle.
