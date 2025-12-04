"use client";

import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Menu, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useUIStore } from "@/store/uiStore";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "./AdminSidebar";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export const AdminShell: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUIStore();
  const { user, signOut, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAdmin = user?.role === "admin";

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

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="card max-w-md px-6 py-6 text-center">
          <h1 className="mb-2 text-lg font-semibold tracking-tight text-slate-100">
            Accès restreint
          </h1>
          <p className="mb-4 text-sm text-slate-400">
            Cette interface est réservée aux administrateurs. Connectez-vous
            avec un compte disposant du rôle adéquat.
          </p>
          <button
            type="button"
            onClick={() => router.push("/auth/sign-in")}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Aller à la connexion
          </button>
        </div>
      </div>
    );
  }

  const title =
    pathname && pathname.startsWith("/admin")
      ? "Admin Chefito – Recettes premium"
      : "Interface d'administration";

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-900/90 md:flex">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <span className="text-sm font-semibold tracking-tight">
            Chefito Admin
          </span>
        </div>
        <div className="flex-1 p-4">
          <AdminSidebar />
        </div>
        <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
          {user?.email}
        </div>
      </aside>

      {/* Sidebar mobile */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-40 md:hidden"
          onClose={closeSidebar}
        >
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/70" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-150 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-150 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-64 flex-col border-r border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
                  <span className="text-sm font-semibold tracking-tight">
                    Chefito Admin
                  </span>
                  <button
                    onClick={closeSidebar}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  >
                    <span className="sr-only">Fermer le menu</span>
                    ×
                  </button>
                </div>
                <div className="flex-1 p-4">
                  <AdminSidebar onNavigate={closeSidebar} />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Zone principale */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-1 text-slate-300 hover:bg-slate-800 md:hidden"
              onClick={toggleSidebar}
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {user && <span>{user.email}</span>}
            <button
              onClick={async () => {
                await signOut();
                router.push("/auth/sign-in");
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              <LogOut className="h-3 w-3" />
              <span>Déconnexion</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};