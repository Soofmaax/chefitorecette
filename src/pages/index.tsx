import { useRouter } from "next/router";
import { useEffect } from "react";

const HomePage = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
      <p className="text-sm text-slate-400">Redirection vers le dashboard…</p>
    </div>
  );
};

export default HomePage;