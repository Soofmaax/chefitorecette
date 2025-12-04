Tu es Genie, un AI Software Engineer qui peut modifier un repo via l’API.

Contexte :
Je veux un petit back-office web (une seule page HTML/JS) pour remplir rapidement ma base Supabase.  
Le but : pouvoir insérer des données dans mes tables principales et appeler des fonctions RPC.

J’ai déjà :
- Un projet Supabase configuré avec toutes mes tables.
- Un repo GitHub vide.

Voici les infos :

- URL du repo GitHub : <<<URL_DU_REPO_GITHUB>>>
- Supabase URL (project URL) : <<<SUPABASE_URL>>>
- Supabase anon public key : <<<SUPABASE_ANON_KEY>>>

Voici mon schéma Supabase (ou un extrait) pour contexte :
<<<COLLER ICI LE SCHÉMA QUE JE T’AI DONNÉ AVANT, SI BESOIN>>>

Je veux que tu fasses TOUT ce qui suit dans le repo :

1. Créer un fichier `index.html` avec :
   - Une petite interface propre et simple (en français) qui :
     - Permet de choisir une table dans une liste déroulante.
     - Génère automatiquement un formulaire pour insérer une ligne dans cette table.
   - Une configuration JS interne (genre `TABLE_CONFIG`) pour les tables suivantes :
     - `recettes_web`
     - `etapes`
     - `ingredients`
     - `recipes`
     - `recipe_steps`
     - `recipe_ingredients`
     - `knowledge_base`
     - `posts`
   - Pour chaque table :
     - Utiliser les colonnes principales et les bons types (text, number, select, textarea, etc.).
     - Gérer les champs spéciaux :
       - `tags` et colonnes similaires comme des tableaux de texte (saisie par virgules).
       - `status`, `difficulty`, etc. avec des `<select>` quand les valeurs sont restreintes.
       - `published_at`, `publish_at` en `datetime-local` puis converties en ISO string.
       - Les champs JSON (embedding_data, metadata, etc.) avec un textarea + parse JSON.
   - Un petit bloc “Appel RPC” qui permet :
     - de saisir le nom d’une fonction Supabase,
     - d’entrer les paramètres en JSON,
     - d’appeler `supabase.rpc()` et d’afficher le résultat (ou au moins un message de succès / erreur).
   - Utiliser `@supabase/supabase-js` via un import ESM depuis un CDN (`https://esm.sh/@supabase/supabase-js@2`).
   - Mettre le texte de l’interface en français.

2. Dans `index.html`, intégrer directement :
   - La création du client :
     - `const supabaseUrl = '<<<SUPABASE_URL>>>';`
     - `const supabaseKey = '<<<SUPABASE_ANON_KEY>>>';`
   - Le code pour :
     - Construire dynamiquement le formulaire en fonction de la table sélectionnée.
     - À la soumission, construire un objet `payload` avec les bons types.
     - Appeler `supabase.from('<nom_table>').insert([payload]).select()` et afficher un message de retour (success / error).

3. Créer un fichier `README.md` qui explique :
   - Le but du projet (back-office minimal pour Supabase).
   - Comment configurer `supabaseUrl` et `supabaseKey` dans `index.html`.
   - Les tables supportées.
   - Comment lancer en local (ex : `python -m http.server 8000` ou `npx serve`).
   - Un rappel qu’il faut adapter ou créer les policies RLS pour autoriser les `INSERT`/RPC pour le rôle `anon`.

4. Optionnel mais souhaité :
   - Avoir un style simple mais propre (CSS basique dans `<style>`).
   - Organiser le code JS proprement dans un `<script type="module">`.

Ta mission :
- Cloner le repo (virtuellement ou via les outils dont tu disposes),
- Créer/éditer les fichiers nécessaires (`index.html`, `README.md`),
- Respecter les conventions du code propre (lisible, simple, pas d’erreurs silencieuses),
- Me renvoyer uniquement les fichiers finaux (contenu complet des fichiers) ou appliquer les modifications via le système d’artefacts si disponible.

Quand tu auras fini, explique-moi rapidement :
- Comment changer/ajouter une table dans la config (`TABLE_CONFIG`),
- Et comment déployer ça sur un hébergement statique (Netlify / Vercel) si je le souhaite.
