import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, error, signOut } = useAuth();
  const [longLoading, setLongLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user && !error) {
      router.replace("/auth/sign-in");
    }
  }, [loading, user, error, router]);

  useEffect(() => {
    if (!loading) {
      setLongLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      setLongLoading(true);
    }, 5000);

    return () => {
      clearTimeout(timeout);
    };
  }, [loading]);

  const handleForceSignOut = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    } finally {
      if (typeof window !== "undefined") {
        // On force une navigation complète pour repartir
        // d'une page de connexion propre.
        window.location.href = "/auth/sign-in";
      } else {
        router.replace("/auth/sign-in");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <LoadingSpinner />
            <span className="text-sm text-slate-400">
              Chargement de la session…
            </span>
          </div>
          {longLoading && (
            <div className="mt-1 text-center text-xs text-slate-400">
              <p className="mb-2">
                Le chargement semble inhabituellement long. Il est possible que
                votre session soit expirée ou bloquée.
              </p>
              <button
                type="button"
                onClick={handleForceSignOut}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-100 hover:bg-slate-800"
              >
                Se reconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="card max-w-md px-6 py-6 text-center">
          <h1 className="mb-2 text-lg font-semibold tracking-tight text-slate-100">
            Problème de configuration
          </h1>
          <p className="mb-3 text-sm text-slate-400">
            Une erreur empêche le chargement de la session d&apos;authentification.
            Vérifiez la configuration Supabase de l&apos;application
            (variables d&apos;environnement sur Vercel).
          </p>
          <p className="text-xs text-slate-500 break-words">{error}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAuthPage = router.pathname.startsWith("/auth");

  return (
    <AuthProvider>
      {isAuthPage ? (
        <Component {...pageProps} />
      ) : (
        <AuthGuard>
          <AppLayout>
            <Component {...pageProps} />
          </AppLayout>
        </AuthGuard>
      )}
    </AuthProvider>
  );
}

export default MyApp;