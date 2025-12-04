import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ResetPasswordForm {
  password: string;
  passwordConfirm: string;
}

const ResetPasswordPage = () => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<ResetPasswordForm>({
    defaultValues: {
      password: "",
      passwordConfirm: ""
    }
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      setCheckingSession(true);
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setErrorMessage(
          "Lien de réinitialisation invalide ou expiré. Veuillez recommencer la procédure."
        );
      }

      setCheckingSession(false);
    };

    checkSession();
  }, []);

  const onSubmit = async (values: ResetPasswordForm) => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (values.password.length < 8) {
      setErrorMessage(
        "Le mot de passe doit contenir au moins 8 caractères."
      );
      return;
    }

    if (values.password !== values.passwordConfirm) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: values.password
    });

    if (error) {
      setErrorMessage(
        error.message ||
          "Impossible de mettre à jour le mot de passe. Le lien est peut-être expiré."
      );
      return;
    }

    setInfoMessage("Votre mot de passe a été mis à jour avec succès.");
    setTimeout(() => {
      router.replace("/auth/sign-in");
    }, 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 px-4">
      <div className="card w-full max-w-md px-6 py-6">
        <h1 className="mb-2 text-lg font-semibold tracking-tight text-slate-100">
          Définir un nouveau mot de passe
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Choisissez un nouveau mot de passe pour votre compte Chefito.
        </p>

        {checkingSession ? (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner className="mr-2" />
            <span className="text-xs text-slate-400">
              Vérification du lien de réinitialisation…
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="password">Nouveau mot de passe</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full"
                  {...register("password", { required: true })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800"
                >
                  {showPassword ? "Masquer" : "Afficher"}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="passwordConfirm">Confirmer le mot de passe</label>
              <input
                id="passwordConfirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="mt-1 w-full"
                {...register("passwordConfirm", { required: true })}
              />
            </div>

            {errorMessage && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {errorMessage}
              </p>
            )}

            {infoMessage && (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {infoMessage}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Mise à jour…
                </>
              ) : (
                "Mettre à jour le mot de passe"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;