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

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session?.user) {
        const userWithRole = await fetchUserWithRole(session.user);
        setUser(userWithRole);
      } else {
        setUser(null);
      }

      setLoading(false);
    };

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      async (_event: string, session: { user: User } | null) => {
        if (session?.user) {
          const userWithRole = await fetchUserWithRole(session.user);
          setUser(userWithRole);
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const result = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!result.error && result.data.user) {
      const userWithRole = await fetchUserWithRole(result.data.user);
      setUser(userWithRole);
    }

    return result;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    loading,
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