-- Ajout d'un indicateur pour contrôler l'inclusion du JSON-LD Schema.org
alter table public.recipes
  add column if not exists schema_jsonld_enabled boolean not null default false;

-- Index simple pour filtrer rapidement les recettes avec JSON-LD activé
create index if not exists recipes_schema_jsonld_enabled_idx
  on public.recipes (schema_jsonld_enabled);