import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Utensils,
  Newspaper,
  Users,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Recettes", href: "/recipes", icon: Utensils },
  { name: "Articles", href: "/articles", icon: Newspaper },
  { name: "Recherche", href: "/search", icon: Newspaper },
  { name: "Utilisateurs", href: "/users", icon: Users },
  { name: "Paramètres", href: "/settings", icon: Settings }
];

interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const router = useRouter();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/dashboard"
            ? router.pathname === "/dashboard"
            : router.pathname.startsWith(item.href);

        return (
          <Link key={item.href} href={item.href} legacyBehavior>
            <a
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                active
                  ? "bg-slate-800 text-primary-200"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.name}</span>
            </a>
          </Link>
        );
      })}
    </nav>
  );
};