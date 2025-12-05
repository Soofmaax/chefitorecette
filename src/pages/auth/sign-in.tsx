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
  const [rememberEmail, setRememberEmail] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedEmail = window.localStorage.getItem("chefito_admin_email");
    if (savedEmail) {
      setValue("email", savedEmail);
      setRememberEmail(true);
    }
  }, [setValue]);

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const onSubmit = async (values: SignInFormValues) => {
    setErrorMessage(null);

    if (typeof window !== "undefined") {
      if (rememberEmail) {
        window.localStorage.setItem("chefito_admin_email", values.email);
      } else {
        window.localStorage.removeItem("chefito_admin_email");
      }
    }

    setAuthSubmitting(true);

    try {
      // eslint-disable-next-line no-console
      console.log("[SignIn] onSubmit start", { email: values.email });

      const { error } = await signInWithEmail(values.email, values.password);

      // eslint-disable-next-line no-console
      console.log("[SignIn] signInWithEmail resolved", { error });

      if (error) {
        // Message volontairement générique pour ne pas donner d'indication
        // sur l'existence du compte ou la nature de l'erreur.
        setErrorMessage("Identifiants invalides. Merci de réessayer.");
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[SignIn] onSubmit error", err);
      setErrorMessage(
        "Une erreur est survenue pendant la connexion. Merci de réessayer."
      );
    } finally {
      setAuthSubmitting(false);
      // eslint-disable-next-line no-console
      console.log("[SignIn] onSubmit finally");
    }
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
            <div className="mt-2 flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                />
                <span>Se souvenir de mon email sur cet appareil</span>
              </label>
            </div>
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
            disabled={isSubmitting || authSubmitting}
          >
            {isSubmitting || authSubmitting ? (
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