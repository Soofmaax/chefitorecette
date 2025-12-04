import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && serviceRoleKey) {
  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "[SupabaseAdmin] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante. Les routes serveur qui en dépendent échoueront."
  );
}

/**
 * Client Supabase réservé aux opérations côté serveur (API routes, server actions)
 * utilisant la clé de rôle de service. Ne jamais importer ce client côté client.
 *
 * En environnement sans configuration (ex: CI sans variables d'env),
 * tout accès à ce client lèvera une erreur explicite.
 */
export const supabaseAdmin =
  adminClient ??
  (new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Supabase admin client non configuré. Vérifie NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY."
        );
      }
    }
  ) as any);