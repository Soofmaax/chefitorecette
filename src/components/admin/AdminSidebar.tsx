"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Utensils,
  AlertTriangle,
  BookOpen,
  Brain,
  Headphones
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Recettes", href: "/admin/recipes", icon: Utensils },
  { name: "Alertes similarité", href: "/admin/alerts", icon: AlertTriangle },
  { name: "Ingrédients", href: "/admin/ingredients", icon: BookOpen },
  { name: "Connaissances", href: "/admin/knowledge", icon: Brain },
  { name: "Audio", href: "/admin/audio", icon: Headphones }
];

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onNavigate }) => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
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
          </Link>
        );
      })}
    </nav>
  );
};