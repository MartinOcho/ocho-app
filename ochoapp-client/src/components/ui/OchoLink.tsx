"use client";

import { useProgress } from "@/context/ProgressContext";
import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React from "react";

// Étendre les propriétés de l'élément HTML <a> et de LinkProps
interface OchoLinkProps extends LinkProps, React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  className?: string;
  underline?: boolean;
}

export default function OchoLink({
  href,
  children,
  className,
  underline,
  ...props
}: OchoLinkProps) {
  const { startNavigation, isPending } = useProgress();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Empêcher le comportement par défaut du lien
    if (isPending) {
      return; // Éviter les déclenchements multiples
    }
    startNavigation(href); // Utiliser la fonction de routage personnalisée
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn("text-primary", underline && "hover:underline max-sm:underline", className)}
      {...props} // Passer toutes les autres propriétés
    >
      {children}
    </Link>
  );
}