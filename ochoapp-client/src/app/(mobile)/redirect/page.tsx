"use client";

import React, { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HomeIcon, MessageSquareHeart } from "lucide-react";
import AppLogo from "@/components/AppLogo";

export default function Page() {
  const searchParams = useSearchParams();
  const { push: navigate } = useRouter();
  const provider = searchParams.get("provider"); // Récupère le provider (google, facebook, etc.)
  const userId = searchParams.get("userId"); // Récupère l'ID de l'utilisateur
  const code = searchParams.get("code"); // Récupère le code d'accès
  const canRedirect = !!(provider && userId && code);

  useEffect(() => {
    if (canRedirect) {
      // Essayer d'ouvrir l'application avec un deep link dans un nouvel onglet
      const deepLink = `ochoapp://auth/${provider}/${userId}/${code}`;
      window.open(deepLink, "_blank");
    }
  }, [canRedirect, code, provider, userId]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 p-4">
      <h1 className="text-xl font-bold">Redirection</h1>
      <div className="flex w-full max-w-lg flex-col justify-center gap-4 rounded-2xl bg-card p-4 text-center shadow-sm">
        <AppLogo size={100} />
        {canRedirect ? (
          <div className="flex flex-col gap-2 px-3">
            <p>
              Si l&apos;application ne s&apos;ouvre pas automatiquement,
              veuillez autoriser les redirections ou{" "}
              <a
                href={`ochoapp://auth/${provider}/${userId}/${code}`}
                target="_blank" // Ouvre le lien dans un nouvel onglet
                rel="noopener noreferrer"
                className="text-primary hover:underline max-sm:underline"
              >
                cliquez ici
              </a>
              .
            </p>
            <p>
              Vous pouvez fermer cet onglet si l&apos;application a été ouverte.
            </p>
          </div>
        ) : (
          <p>Vous pouvez fermer cet onglet si aucune redirection n&apos;est en cours.</p>
        )}
        <div className="flex justify-center gap-3 max-sm:flex-col sm:w-full">
          <Button
            className="max-w-70 flex items-center gap-2 bg-white text-black ring-1 ring-primary @container hover:text-primary-foreground active:text-primary-foreground sm:w-full"
            onClick={() => navigate("/android/download")}
          >
            <AndroidLogo size={24} />{" "}
            <span className="hidden @[11rem]:inline">
              Telecharger l&apos;application
            </span>
          </Button>
          <Button
            className="max-w-70 flex items-center gap-2 bg-white text-black ring-1 ring-primary @container hover:text-primary-foreground active:text-primary-foreground sm:w-full"
            onClick={() => navigate("/")}
          >
            <HomeIcon size={24} />{" "}
            <span className="hidden @[11rem]:inline">
              Revenir à l&apos;accueil
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AndroidLogoProps {
  className?: string;
  size?: number;
}

function AndroidLogo({ className, size = 48 }: AndroidLogoProps) {
  return (
    <svg viewBox="0 0 65 65" className={className} width={size} height={size}>
      <path
        fill="#3DDB85"
        d="M46.8,38.8c-1.4,0-2.6-1.2-2.6-2.6c0-1.4,1.2-2.6,2.6-2.6c1.4,0,2.6,1.2,2.6,2.6C49.5,37.6,48.3,38.8,46.8,38.8
	 M18.1,38.8c-1.4,0-2.6-1.2-2.6-2.6c0-1.4,1.2-2.6,2.6-2.6s2.6,1.2,2.6,2.6S19.5,38.8,18.1,38.8 M47.8,23.1l5.2-9
	c0.3-0.5,0.1-1.2-0.4-1.5s-1.2-0.2-1.5,0.4l-5.3,9.1c-4-1.8-8.6-2.9-13.4-2.9s-9.3,1.1-13.3,2.9L13.8,13c-0.3-0.5-1-0.7-1.5-0.4
	c-0.5,0.3-0.7,1-0.4,1.5l5.2,9C8.2,27.9,2.1,37,1.2,47.7h62.5C62.8,37,56.7,27.9,47.8,23.1"
      />
    </svg>
  );
}
