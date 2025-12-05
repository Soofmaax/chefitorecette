# TODO – Backoffice Chefito

Liste des améliorations et chantiers restant à mener, classés par priorité.

## 🔴 Haute priorité

- **RLS – vérification & durcissement global**
  - Vérifier dans Supabase que toutes les tables utilisées par l’admin ont bien RLS activé :
    - `recipes`, `recipe_ingredients_normalized`, `recipe_steps_enhanced`,
      `recipe_concepts`, `knowledge_base`, `ingredients_catalog`,
      `audio_library`, `audio_mapping`, `recipe_similarity_alerts`,
      `recipe_relationships`, `audio_usage_stats`, `editorial_calendar`.
  - Appliquer des policies cohérentes avec `SECURITY.md` :
    - lecture `admin` + `editor`,
    - écriture `admin` (ou `editor` si besoin, ex. `recipes`).

- **Intégration front JSON-LD**
  - Le backoffice génère déjà un JSON-LD complet + le flag `schema_jsonld_enabled`.
  - À faire côté site public :
    - Lire ce flag et injecter le JSON-LD dans `<script type="application/ld+json">`.
    - Définir les URL canoniques à partir de la configuration front (`NEXT_PUBLIC_SITE_URL`).

- **Tests E2E / smoke-tests**
  - Ajouter quelques tests de non-régression (Playwright/Cypress) pour :
    - le flux d’édition recette,
    - le flux d’import CSV éditorial,
    - la route `/api/recipes/merge` (avec utilisateur admin vs non admin).

## 🟠 Priorité moyenne

- **Améliorer la robustesse de l’import CSV éditorial**
  - Supporter les CSV avec guillemets et virgules internes via une lib dédiée (`papaparse` par exemple).
  - Proposer une option “Télécharger les lignes en erreur” pour correction offline (CSV des lignes non importées).

- **UX calendrier éditorial**
  - Ajouter le drag & drop entre colonnes dans la vue Kanban (mise à jour de `status` en temps réel).
  - Permettre l’édition rapide du `chefito_angle`, de la catégorie et des tags directement depuis la liste.

- **Prévisualisation recette dans l’admin**
  - Ajouter une page `/admin/recipes/[id]/preview` qui :
    - rend une version simplifiée de la page publique,
    - utilise les mêmes composants de mise en forme que le front.

## 🟡 Priorité basse

- **Rate limiting côté infra**
  - Mettre en place un rate limit sur `/api/recipes/merge` et futures routes critiques via :
    - reverse proxy (NGINX, Traefik, Cloudflare, Vercel Edge Middleware…),
    - ou service WAF managé.

- **Journalisation d’audit**
  - Ajouter une table `admin_audit_log` :
    - trace des opérations sensibles (merge recettes, suppressions, changements de statut).
  - Intégrer l’écriture des logs dans les routes ou dans des triggers SQL.

- **Refactor / factorisation**
  - Factoriser les helpers de qualité éditoriale (actuellement dupliqués entre la liste et l’éditeur de recette).
  - Extraire la logique de construction JSON-LD pour la rendre réutilisable côté front public.

Ce fichier est volontairement court et pragmatique : il sert de backlog minimal pour les prochaines itérations produit / sécurité.  
Mettre à jour au fur et à mesure des évolutions.