import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import "../styles/globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/sign-in");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3">
          <LoadingSpinner />
          <span className="text-sm text-slate-400">
            Chargement de la session…
          </span>
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