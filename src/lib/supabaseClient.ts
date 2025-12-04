import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseClient: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // On ne casse pas le build si les variables ne sont pas définies.
  // Toute utilisation de Supabase côté runtime sans configuration
  // lèvera une erreur explicite.
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquante."
  );
}

export const supabase =
  supabaseClient ??
  (new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Supabase client non configuré. Vérifie NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
      }
    }
  ) as any);

// Helpers utilisés dans les formulaires
export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};

export const getCurrentUser = async () => {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
};