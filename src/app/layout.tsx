import type { Metadata } from "next";
import React from "react";
import "../styles/globals.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "Chefito Admin",
  description:
    "Interface d'administration pour les recettes enrichies et le RAG"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}