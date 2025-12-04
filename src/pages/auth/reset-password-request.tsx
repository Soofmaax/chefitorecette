import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface ResetPasswordRequestForm {
  email: string;
}

const ResetPasswordRequestPage = () => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting }
  } = useForm<ResetPasswordRequestForm>({
    defaultValues: {
      email: ""
    }
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const onSubmit = async (values: ResetPasswordRequestForm) => {
    setErrorMessage(null);
    setInfoMessage(null);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const redirectTo = `${siteUrl}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo
    });

    if (error) {
      setErrorMessage(
        error.message ||
          "Impossible d'envoyer l'email de réinitialisation. Vérifiez l'adresse saisie."
      );
      return;
    }

    setInfoMessage(
      "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 px-4">
      <div className="card w-full max-w-md px-6 py-6">
        <h1 className="mb-2 text-lg font-semibold tracking-tight text-slate-100">
          Réinitialiser votre mot de passe
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Saisissez l&apos;adresse email de votre compte. Vous recevrez un lien
          pour définir un nouveau mot de passe.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full"
              {...register("email", { required: true })}
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
                Envoi en cours…
              </>
            ) : (
              "Envoyer le lien de réinitialisation"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordRequestPage;