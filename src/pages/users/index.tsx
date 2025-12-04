import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface UserProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, created_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setUsers(data as UserProfileRow[]);
      }
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50">
          Utilisateurs
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Profils provenant de la table <code>user_profiles</code> avec leurs
          rôles.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
          {loading
            ? "Chargement des utilisateurs…"
            : `${users.length} utilisateurs`}
        </div>

        <div className="max-h-[480px] overflow-auto text-sm">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Nom complet</th>
                <th className="px-4 py-2 text-left">Rôle</th>
                <th className="px-4 py-2 text-left">Créé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-400"
                  >
                    <LoadingSpinner className="mr-2 inline-block" />
                    Chargement…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2 text-slate-300">
                      {user.full_name || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-300">
                      {user.role || "editor"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;