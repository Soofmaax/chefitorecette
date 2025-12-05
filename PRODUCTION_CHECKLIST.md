# Production Checklist – Backoffice Chefito

Ce document décrit les étapes à suivre pour rendre l’admin Chefito prête pour la production.

---

## 1. Pré-déploiement technique

### 1.1. CI / Qualité

- [ ] **CI GitHub Actions verte** sur la branche de release
  - Job `quality-check` :
    - `npm run lint`
    - `npm run typecheck`
  - Job `build` :
    - `npm run build`
  - Job `security-scan` :
    - `npm audit --audit-level=high`
    - CodeQL v4 (JavaScript/TypeScript)
  - Job `tests` :
    - `npm test` si présent (sinon étape skip loggée)

- [ ] **Lint local**
  - `npm run lint` → 0 erreurs.
- [ ] **TypeScript strict**
  - `npm run typecheck` → 0 erreurs.

> Note : `npm run format:check` n’est pas exécuté en CI pour ne pas casser l’historique.  
> Les nouveaux commits sont formatés via Husky + lint-staged.

---

## 2. Configuration Supabase (critique)

### 2.1. Variables d’environnement Supabase

Dans votre projet Supabase, relever :

- URL du projet (`supabaseUrl`)
- Clé anonyme (`anonKey`)
- Clé service role (`serviceRoleKey`)

### 2.2. RLS & policies

Pour chaque table critique :

- [ ] **RLS activée** :

  - `recipes`
  - `recipe_ingredients_normalized`
  - `recipe_steps_enhanced`
  - `recipe_concepts`
  - `knowledge_base`
  - `ingredients_catalog`
  - `audio_library`
  - `audio_mapping`
  - `audio_usage_stats`
  - `recipe_similarity_alerts`
  - `recipe_relationships`
  - `editorial_calendar`
  - `user_profiles` (ou équivalent)

- [ ] **Policies alignées avec SECURITY.md** :

  Exemples de patterns attendus (à adapter) :

  ```sql
  -- Lecture admin + editor
  create policy admin_editor_select
  on public.recipes
  for select
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'editor')
    )
  );

  -- Écriture admin (ou editor selon le besoin)
  create policy admin_modify
  on public.recipes
  for all
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
  ```

- [ ] **Aucun accès anonyme** aux tables d’admin (sauf vues publiques explicitement prévues).

### 2.3. SQL auxiliaire à exécuter

- [ ] `sql/editorial_calendar.sql` (si non encore appliqué)
- [ ] `sql/indexes_recipes.sql` (indexes performance)
- [ ] `sql/knowledge_base_enrich.sql` (colonnes enrichies)
- [ ] `sql/recipes_schema_jsonld.sql` (flag `schema_jsonld_enabled`)

---

## 3. Variables d’environnement (prod)

Créer les env dans votre plateforme de déploiement (Vercel, Fly.io, Docker, etc.) :

**Obligatoires :**

- [ ] `NEXT_PUBLIC_SUPABASE_URL`  
  URL publique du projet Supabase.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
  Clé anonyme (publique).
- [ ] `SUPABASE_SERVICE_ROLE_KEY`  
  Clé service role (strictement côté serveur).
- [ ] `NEXT_PUBLIC_SITE_URL`  
  URL publique du site de recettes (ex: `https://chefito.com`).

**Recommandées :**

- [ ] `NODE_ENV=production`
- [ ] `NEXT_TELEMETRY_DISABLED=1` (si vous souhaitez désactiver la télémétrie Next.js)
- [ ] `LOG_LEVEL` (si vous avez une stratégie de logs)

> Important : ne jamais injecter `SUPABASE_SERVICE_ROLE_KEY` côté client (Vercel Project Env → Server-side only).

---

## 4. Déploiement de l’application

### 4.1. Build et start

En prod :

- [ ] `npm install --production` (ou `npm ci`)
- [ ] `npm run build`
- [ ] `npm run start` (ou déploiement via Vercel qui gère ces étapes)

### 4.2. Vérification des endpoints

- [ ] `/auth/sign-in` → formulaire de connexion visible, erreurs correctes si mauvais login.
- [ ] `/admin` sans session → redirection / blocage (selon votre logique de guard).
- [ ] `/admin/recipes` avec un compte `editor` ou `admin` → accessible.
- [ ] `/admin/dashboard` avec un compte `editor` ou `admin` → metrics chargées.

---

## 5. Tests manuels à exécuter avant mise en prod

### 5.1. Flux Recettes

- [ ] **Créer une recette depuis `/admin/recipes/create`**
  - Saisir infos de base, ingrédients, instructions, SEO.
  - Enregistrer → vérifier qu’elle apparaît dans `/admin/recipes`.
- [ ] **Éditer une recette**
  - Modifier description, image, SEO, tags, etc.
  - Sauvegarder → pas d’erreur, messages corrects.
- [ ] **Validation pre-publish**
  - Essayer de passer directement une recette en `published` avec des champs manquants.
  - Vérifier que la modale de blocage s’ouvre avec la liste des critères manquants.
- [ ] **Recette complète (éditoriale + RAG)**
  - Remplir tous les champs éditoriaux & SEO requis + ingrédients normalisés + steps enrichies + concepts.
  - Passer le statut en `published` → succès.

### 5.2. Flux Auth / Mot de passe

- [ ] **Connexion email + mot de passe**
  - Aller sur `/auth/sign-in`.
  - Se connecter avec un compte admin (`user_profiles.role = 'admin'`).
  - Vérifier que la redirection vers `/admin/recipes` ou `/admin/dashboard` fonctionne.
- [ ] **Mot de passe oublié**
  - Depuis `/auth/sign-in`, cliquer sur “Mot de passe oublié ? Réinitialiser”.
  - Sur `/auth/reset-password-request`, saisir l’email d’un compte existant.
  - Vérifier que l’email de reset est bien reçu et que le lien pointe vers le domaine Vercel (et non localhost).
- [ ] **Définir un nouveau mot de passe**
  - Depuis l’email, cliquer sur le lien de réinitialisation.
  - Vérifier que la page `/auth/reset-password` s’affiche et que le lien est accepté (pas d’erreur “lien expiré”).
  - Saisir un nouveau mot de passe + confirmation (utiliser le bouton “Afficher/Masquer” pour vérifier la saisie).
  - Valider, attendre la confirmation, puis vérifier la redirection vers `/auth/sign-in`.
  - Se reconnecter avec l’email et le **nouveau** mot de passe.

### 5.3. RAG & intégrations

- [ ] **Ingrédients normalisés**
  - Sur `/admin/recipes/[id]/edit`, onglet Ingrédients structurés.
  - Ajouter plusieurs lignes, sauvegarder, recharger la page → données persistées.
- [ ] **Étapes enrichies**
  - Onglet Étapes enrichies.
  - Ajouter/modifier des steps avec Tiptap, sauvegarder, recharger → OK.
- [ ] **Concepts scientifiques**
  - Lier un ou plusieurs concepts à une recette, vérifier la checklist RAG.

### 5.3. Calendrier éditorial & import CSV

- [ ] `/admin/editorial-calendar`
  - Filtres, recherche, changement de statut/priorité → OK.
- [ ] `/admin/editorial-calendar/import`
  - Import d’un CSV valide :
    - mapping auto + manuel → preview OK,
    - import → lignes valides créées dans `editorial_calendar`.
  - Import d’un CSV avec erreurs :
    - lignes invalides listées avec messages,
    - uniquement les lignes valides insérées.

### 5.4. Alertes de similarité & fusion

- [ ] `/admin/alerts` avec un compte `admin`
  - Visualiser une alerte : liens vers les recettes OK.
  - Tester “Marquer comme variantes” → vérifier `recipe_relationships`.
  - Tester “Fusionner (garder existante/nouvelle)” :
    - `recipes`, `recipe_ingredients_normalized`, `recipe_steps_enhanced`,
      `recipe_concepts`, `audio_usage_stats` repointés vers la recette canonique,
    - la recette dupliquée passe en `draft` avec slug suffixé `-fusionnee`,
    - l’alerte passe en `resolved` + `resolution = 'merged'`.
- [ ] **Avec un compte non admin**
  - Appeler la fusion depuis l’UI (si visible) doit renvoyer une erreur 403 claire.
  - Idéalement, l’UI ne doit pas présenter la fusion aux non-admin.

### 5.5. Audio

- [ ] `/admin/audio`
  - Upload d’un fichier audio ≤ 20 Mo → succès, entrée dans `audio_library`.
  - Upload d’un fichier trop lourd ou non audio → message d’erreur lisible.
  - Création d’un mapping `audio_mapping` → visible dans la liste.

### 5.6. JSON-LD (admin)

- [ ] `/admin/recipes/[id]/edit`
  - Vérifier l’onglet ou section “SEO avancé – JSON-LD Recipe” :
    - JSON généré,
    - liste d’éventuels “issues” JSON-LD vide ou correcte.

---

## 6. Monitoring & Observabilité

### 6.1. Erreurs applicatives

- [ ] Brancher un outil type **Sentry**, LogRocket, ou équivalent.
  - Configuration minimale :
    - capture des erreurs sur les pages admin,
    - tagging par environnement (`staging`, `production`),
    - éventuellement capture des logs de la route `/api/recipes/merge`.

### 6.2. Logs serveur

- [ ] Vérifier que les logs Next.js (console) sont bien collectés par votre plateforme.
  - Rechercher `[recipes/merge] error` en cas de problème.

---

## 7. Analytics (optionnel mais recommandé)

- [ ] Décider de l’outil d’analytics pour l’admin (ou pas d’analytics si strictement interne).
  - Plausible / Matomo / GA4, selon vos contraintes RGPD.
- [ ] Si tracking frontend activé :
  - Pas de collecte de données personnelles inutiles.
  - Eventuellement suivre :
    - ouverture des pages clés,
    - taux de complétion sur certaines actions (import CSV, enrichissement des fiches recettes…).

---

## 8. Sauvegardes & Rollback

### 8.1. Backups Supabase

- [ ] Vérifier que Supabase (ou PostgreSQL) dispose d’un **plan de backup** :
  - snapshots automatiques,
  - rétention (ex: 7/30 jours),
  - procédure de restauration documentée.

### 8.2. Rollback applicatif

- [ ] Documenter un **plan de rollback** du front :
  - via git tags / releases,
  - ou fonctionnalités de rollback du provider (Vercel “rollback to previous deployment”).
- [ ] Stratégie en cas de bug critique :
  - rollback de la version précédente,
  - désactivation temporaire de certaines features via feature flags ou hides.

---

## 9. Documentation & README

### 9.1. README

- [ ] Section “Installation & exécution locale” (déjà présente).
- [ ] Section “Configuration Supabase & environnement” (déjà présente).
- [ ] **Ajouter un court paragraphe “Déploiement”** (recommandé) :
  - commandes `npm run build` / `npm run start`,
  - référence à ce fichier `PRODUCTION_CHECKLIST.md`.

### 9.2. Fichiers de référence

- [ ] `SECURITY.md` à jour (modèle de sécurité Supabase).
- [ ] `TODO.md` révisé pour :
  - ce qui doit être fait pré-prod,
  - ce qui est backlog post-lancement.

---

En suivant cette checklist, vous réduisez fortement les risques de surprises en production, tout en gardant une vue claire sur les éléments critiques (RLS, sécurité, flux clés de l’admin).