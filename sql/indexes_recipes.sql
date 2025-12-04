-- Indexes recommandés pour optimiser l'admin recettes
-- À exécuter dans le SQL editor de Supabase (une seule fois).

-- Filtres fréquents
create index if not exists idx_recipes_status on public.recipes (status);
create index if not not exists idx_recipes_difficulty on public.recipes (difficulty);
create index if not exists idx_recipes_category on public.recipes (category);
create index if not exists idx_recipes_cuisine on public.recipes (cuisine);

-- Accès direct par slug
create index if not exists idx_recipes_slug on public.recipes (slug);

-- Accès direct par created_at (tri)
create index if not exists idx_recipes_created_at on public.recipes (created_at);

-- NOTE : les recherches plein texte actuelles utilisent ILIKE avec un % en début de chaîne.
-- Les index simples ne seront pas utilisés par Postgres pour ces patterns.
-- Pour aller plus loin, il faudra ajouter une colonne tsvector et un index GIN, par exemple :
--
--   alter table public.recipes
--   add column if not exists search_vector tsvector generated always as (
--     to_tsvector('simple',
--       coalesce(title, '') || ' ' ||
--       coalesce(description, '') || ' ' ||
--       coalesce(ingredients_text, '') || ' ' ||
--       coalesce(instructions_detailed, '')
--     )
--   ) stored;
--
--   create index if not exists idx_recipes_search_vector
--   on public.recipes using gin (search_vector);
--
-- Puis remplacer les ILIKE par une requête to_tsquery / plainto_tsquery.