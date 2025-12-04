import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  className,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition";
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
      "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 focus:ring-offset-slate-900",
    secondary:
      "bg-slate-800 text-slate-100 hover:bg-slate-700 focus:ring-slate-600 focus:ring-offset-slate-900",
    ghost:
      "bg-transparent text-slate-200 hover:bg-slate-800 focus:ring-slate-700 focus:ring-offset-slate-900"
  };

  return (
    <button
      className={cn(base, variants[variant], className)}
      {...props}
    />
  );
};