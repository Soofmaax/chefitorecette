import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Menu, LogOut } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useUIStore } from "@/store/uiStore";
import { useAuth } from "@/hooks/useAuth";

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sidebarOpen, toggleSidebar, closeSidebar } = useUIStore();
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-900/90 md:flex">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <span className="text-sm font-semibold tracking-tight">
            RAG Admin
          </span>
        </div>
        <div className="flex-1 p-4">
          <Sidebar />
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
                    RAG Admin
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
                  <Sidebar onNavigate={closeSidebar} />
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
              Interface d'administration RAG
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {user && <span>{user.email}</span>}
            <button
              onClick={signOut}
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

export default AppLayout;