import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export type Role = "admin" | "editor" | null;

export type AuthUser = User & {
  appRole: Role;
};

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchUserWithRole(user: User): Promise<AuthUser> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    ...user,
    appRole: (profile?.role as Role) ?? null
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) {
          // eslint-disable-next-line no-console
          console.error(
            "[Auth] Erreur lors de la récupération de la session",
            sessionError
          );
          setError("Impossible de récupérer la session d'authentification.");
          setUser(null);
          return;
        }

        if (session?.user) {
          const userWithRole = await fetchUserWithRole(session.user);
          setUser(userWithRole);
        } else {
          setUser(null);
        }
      } catch (err) {
        // Ce bloc intercepte notamment l'erreur "Supabase client non configuré"
        // lorsque les variables d'environnement ne sont pas définies.
        // eslint-disable-next-line no-console
        console.error("[Auth] Erreur d'initialisation de la session", err);
        setError(
          "Erreur de configuration de l'authentification. Vérifiez les variables d'environnement Supabase (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)."
        );
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();

    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (_event: string, session: { user: User } | null) => {
          try {
            // eslint-disable-next-line no-console
            console.log(
              "[Auth] onAuthStateChange",
              _event,
              "session user ?",
              !!session?.user
            );

            if (session?.user) {
              const userWithRole = await fetchUserWithRole(session.user);
              setUser(userWithRole);
            } else {
              setUser(null);
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              "[Auth] Erreur lors de la mise à jour de la session",
              err
            );
            setError(
              "Erreur de configuration de l'authentification. Vérifiez les variables d'environnement Supabase."
            );
            setUser(null);
          } finally {
            // Après tout changement d'état d'authentification,
            // on considère que le chargement est terminé.
            setLoading(false);
          }
        }
      );

      subscription = data.subscription;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        "[Auth] Erreur lors de l'inscription aux changements d'état d'authentification",
        err
      );
      setError(
        "Erreur de configuration de l'authentification. Vérifiez les variables d'environnement Supabase."
      );
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      // eslint-disable-next-line no-console
      console.log("[Auth] signInWithEmail start", { email });

      const {
        data,
        error
      } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // eslint-disable-next-line no-console
      console.log("[Auth] signInWithEmail result", { data, error });

      if (error) {
        setLoading(false);
        return { data, error };
      }

      if (data?.user) {
        const userWithRole = await fetchUserWithRole(data.user);
        setUser(userWithRole);
      }

      setLoading(false);
      return { data, error: null };
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("[Auth] Erreur lors de la tentative de connexion", err);
      setError(
        "Erreur de configuration de l'authentification. Impossible de se connecter. Contactez un administrateur."
      );
      setLoading(false);

      const error =
        err instanceof Error ? err : new Error(String(err ?? "Unknown error"));

      return { data: null, error };
    }
  };

  const signOut = async () => {
    setError(null);

    try {
      await supabase.auth.signOut();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Auth] Erreur lors de la déconnexion", err);
      setError("Erreur lors de la déconnexion.");
    } finally {
      setUser(null);
    }
  };

  const value: AuthContextValue = {
    user,
    loading,
    error,
    signInWithEmail,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return ctx;
};