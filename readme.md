# Back-office Supabase minimal

Petit back-office web (une seule page HTML/JS) pour insérer rapidement des données dans une base Supabase et appeler des fonctions RPC.

L’objectif est de disposer d’un outil simple, sans framework, que l’on peut ouvrir dans un navigateur (ou déployer en statique) pour manipuler les tables principales du projet.

---

## Structure du projet

- `index.html`  
  Page unique contenant :
  - le HTML,
  - le CSS (dans un bloc `<style>`),
  - le JavaScript (dans un `<script type="module">`),
  - la configuration des tables (`TABLE_CONFIG`),
  - la création du client Supabase.
- `readme.md`  
  Ce fichier de documentation.

---

## Configuration Supabase

Dans `index.html`, le client Supabase est créé directement dans le script :

```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "<<<SUPABASE_URL>>>";
const supabaseKey = "<<<SUPABASE_ANON_KEY>>>";

const supabase = createClient(supabaseUrl, supabaseKey);
```

À adapter ainsi :

1. Remplace `<<<SUPABASE_URL>>>` par l’URL de ton projet Supabase (Project URL).
2. Remplace `<<<SUPABASE_ANON_KEY>>>` par la clé publique anonyme (anon public key) de ton projet.
3. Enregistre le fichier et recharge la page dans ton navigateur.

> Attention : cette interface utilise la clé **anon** directement dans le front.  
> Vérifie bien tes politiques RLS (Row Level Security) pour ne pas exposer plus de données que nécessaire.

---

## Tables supportées

La configuration interne `TABLE_CONFIG` couvre les tables suivantes :

- `recettes_web`
- `etapes`
- `ingredients`
- `recipes`
- `recipe_steps`
- `recipe_ingredients`
- `knowledge_base`
- `posts`

Pour chaque table, `TABLE_CONFIG` décrit :

- le nom de la table,
- la liste des colonnes éditables,
- le type de champ (texte, nombre, select, datetime, JSON, etc.),
- les champs spéciaux :
  - `tags` (convertis en tableau de chaînes, via séparation par virgules),
  - `status`, `difficulty`, etc. (rendus en `<select>` quand les valeurs sont connues),
  - `published_at`, `publish_at` (inputs `datetime-local` convertis en ISO string),
  - champs JSON (`embedding_data`, `metadata`, etc.) via un `<textarea>` + `JSON.parse`.

**Important :**  
La configuration fournie est un point de départ. Tu peux (et dois) ajuster les colonnes pour qu’elles correspondent exactement à ton schéma Supabase réel.

---

## Comment lancer en local

Comme il s’agit d’un projet purement statique, il suffit d’un serveur HTTP basique.

### Option 1 — avec Python (3.x)

Dans le répertoire du projet :

```bash
python -m http.server 8000
```

Puis ouvre ton navigateur sur :

```text
http://localhost:8000/index.html
```

### Option 2 — avec Node (`npx serve`)

Si tu as Node.js installé :

```bash
npx serve .
```

Par défaut, `serve` indiquera l’URL (souvent `http://localhost:3000`).

---

## Utilisation de l’interface

### Insertion dans les tables

1. Ouvre `index.html` dans ton navigateur via un serveur local (voir ci-dessus).
2. Choisis une table dans la liste déroulante.
3. Le formulaire correspondant à la table sélectionnée est généré dynamiquement.
4. Remplis les champs souhaités :
   - Les champs `tags` sont saisis comme `tag1, tag2, tag3`.
   - Les champs dates (`published_at`, `publish_at`) utilisent un input `datetime-local`.
   - Les champs JSON (par ex. `metadata`, `embedding_data`) doivent contenir un JSON valide :
     ```json
     {
       "foo": "bar"
     }
     ```
5. Clique sur **“Insérer dans &lt;nom_de_table&gt;”**.
6. Le résultat de l’insertion est affiché (succès + ligne insérée ou message d’erreur Supabase).

### Appel de fonctions RPC

Dans le bloc **Appel RPC** (à droite) :

1. Renseigne le **nom de la fonction** (tel que défini côté Postgres/Supabase).
2. (Optionnel) Saisis un objet JSON de paramètres, par exemple :
   ```json
   {
     "id": 1,
     "limit": 10
   }
   ```
3. Clique sur **“Exécuter la fonction”**.
4. Le statut (succès / erreur) est affiché, ainsi que le résultat JSON brut de `supabase.rpc(...)`.

---

## RLS / sécurité

Cette page utilise la **clé publique anon** de ton projet Supabase.  
Pour qu’elle fonctionne :

- Active RLS sur tes tables si ce n’est pas déjà fait.
- Crée ou adapte des politiques pour :
  - autoriser les `INSERT` sur les tables concernées pour le rôle `anon`,
  - autoriser les appels RPC nécessaires (`rpc`) pour le rôle `anon`.

Exemples de bonnes pratiques :

- Limiter les insertions au minimum nécessaire (par colonne et par table).
- Filtrer les données accessibles par `SELECT` si l’interface est utilisée en production.
- Éviter d’exposer cette page sur un domaine public sans réflexion préalable sur les politiques RLS.

---

## Modifier ou ajouter une table dans `TABLE_CONFIG`

Tout se passe dans `index.html`, dans la constante `TABLE_CONFIG`.

### Modifier une table existante

1. Ouvre `index.html`.
2. Repère la section correspondante, par exemple :

   ```js
   const TABLE_CONFIG = {
     recipes: {
       label: "recipes",
       fields: [
         { name: "title", label: "Titre", type: "text", required: true },
         // ...
       ],
     },
     // ...
   };
   ```

3. Ajoute, supprime ou modifie les entrées du tableau `fields` pour qu’elles reflètent tes colonnes Supabase.

Chaque champ accepte notamment :

- `name` : nom exact de la colonne dans Supabase.
- `label` : texte affiché dans le formulaire (en français).
- `type` : parmi `"text"`, `"textarea"`, `"number"`, `"integer"`, `"select"`, `"tags"`, `"datetime"`, `"json"`, `"boolean"`.
- `required` : `true`/`false` (HTML `required` + validation côté JS).
- `options` : pour les `type: "select"` (ex. `["draft", "published", "archived"]`).
- `placeholder`, `helperText` : pour améliorer l’UX.

### Ajouter une nouvelle table

1. Dans `TABLE_CONFIG`, ajoute une nouvelle entrée :

   ```js
   const TABLE_CONFIG = {
     // ... tables existantes ...
     ma_nouvelle_table: {
       label: "ma_nouvelle_table",
       fields: [
         { name: "title", label: "Titre", type: "text", required: true },
         { name: "status", label: "Statut", type: "select", options: ["draft", "published"] },
         { name: "tags", label: "Tags", type: "tags" },
         { name: "metadata", label: "Métadonnées (JSON)", type: "json" },
       ],
     },
   };
   ```

2. Sauvegarde, recharge la page : la table apparaîtra automatiquement dans la liste déroulante.

---

## Déploiement sur un hébergement statique

Ce projet est purement statique (HTML/JS/CSS). Tu peux le déployer très facilement.

### Netlify

1. Crée un nouveau site sur Netlify.
2. Connecte ton repo GitHub ou uploade le dossier.
3. Paramètres de build :
   - **Build command** : (vide)
   - **Publish directory** : `.` (racine, ou un sous-dossier si tu préfères).
4. Déploie.  
   Netlify servira directement `index.html` à la racine.

### Vercel

1. `vercel init` ou création de projet via l’interface Web en pointant sur ton repo.
2. Dans la configuration du projet :
   - Framework preset : **Other** / **Static**.
   - Output directory : `.` (ou le dossier contenant `index.html`).
3. Aucune commande de build n’est nécessaire, Vercel servira le contenu tel quel.

> Dans les deux cas, pense à vérifier que les domaines (Netlify/Vercel) sont autorisés dans les paramètres CORS de ton projet Supabase si besoin.

---
