import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const HomePage = () => {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.appRole === "admin") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [router, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
      <p className="text-sm text-slate-400">Redirection vers le dashboard…</p>
    </div>
  );
};

export default HomePage;