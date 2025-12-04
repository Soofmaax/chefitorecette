const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Zone de configuration générale de l’interface d’administration RAG.
        </p>
      </div>

      <div className="card px-5 py-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold text-slate-100">
          Configuration Supabase (frontend)
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Cette interface utilise les variables d’environnement suivantes,
          exposées côté client :
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
          <li>
            <code className="rounded bg-slate-800/80 px-1">
              NEXT_PUBLIC_SUPABASE_URL
            </code>
          </li>
          <li>
            <code className="rounded bg-slate-800/80 px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>
          </li>
        </ul>

        <p className="mt-4 text-xs text-slate-400">
          La clé <code>SUPABASE_SERVICE_ROLE_KEY</code> doit rester côté
          serveur (Edge Functions / API backend) et ne jamais être exposée dans
          cette interface.
        </p>

        <h2 className="mt-6 text-sm font-semibold text-slate-100">
          RLS &amp; Permissions
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          Assurez-vous que vos politiques RLS sur les tables{" "}
          <code>recipes</code>, <code>posts</code> et{" "}
          <code>user_profiles</code> autorisent les actions appropriées pour
          les rôles <code>admin</code> et <code>editor</code>, comme décrit
          dans votre configuration Supabase.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;