import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[SupabaseAdmin] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante. Les routes serveur qui en dépendent échoueront."
  );
}

/**
 * Client Supabase réservé aux opérations côté serveur (API routes, server actions)
 * utilisant la clé de rôle de service. Ne jamais importer ce client côté client.
 */
export const supabaseAdmin = createClient(
  supabaseUrl ?? "",
  serviceRoleKey ?? ""
);