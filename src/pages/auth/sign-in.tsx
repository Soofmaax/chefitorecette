import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, SignInFormValues } from "@/types/forms";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const SignInPage = () => {
  const router = useRouter();
  const { user, signInWithEmail } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const onSubmit = async (values: SignInFormValues) => {
    setErrorMessage(null);
    const { error } = await signInWithEmail(values.email, values.password);
    if (error) {
      // Message volontairement générique pour ne pas donner d'indication
      // sur l'existence du compte ou la nature de l'erreur.
      setErrorMessage("Identifiants invalides. Merci de réessayer.");
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 px-4">
      <div className="card w-full max-w-md px-6 py-6">
        <h1 className="mb-2 text-lg font-semibold tracking-tight text-slate-100">
          Connexion à l’espace d’administration
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          Connectez-vous avec vos identifiants d’administrateur ou d’éditeur.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full"
              {...register("email")}
            />
            {errors.email && (
              <p className="form-error">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password">Mot de passe</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="w-full"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
            {errors.password && (
              <p className="form-error">{errors.password.message}</p>
            )}
          </div>

          {errorMessage && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {errorMessage}
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
                Connexion…
              </>
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2 text-xs text-slate-500">
          <Link
            href="/auth/reset-password-request"
            className="text-xs text-primary-300 hover:text-primary-200"
          >
            Mot de passe oublié ? Réinitialiser
          </Link>
        </div>

        </div>
    </div>
  );
};

export default SignInPage;