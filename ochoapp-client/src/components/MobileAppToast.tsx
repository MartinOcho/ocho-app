"use client";

import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLogo from "./AppLogo";

export default function MobileAppToast({
  packageName = "com.ochokom.ochoapp",
  scheme = "ochoapp",
}) {
  const [isAndroid, setIsAndroid] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [intentUrl, setIntentUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent || navigator.vendor;
    const isAndroidDevice = /Android/i.test(userAgent);

    if (isAndroidDevice) {
      setIsAndroid(true);
      setIsVisible(true);

      // Récupération dynamique du chemin web courant (ex: "post/123?ref=share")
      const currentPath =
        window.location.pathname.replace(/^\//, "") + window.location.search;
      const currentFullUrl = encodeURIComponent(window.location.href);

      // Construction du schéma Intent pour Android Chrome
      const formattedIntent = `intent://${currentPath}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${currentFullUrl};end`;
      setIntentUrl(formattedIntent);
    }
  }, [packageName, scheme]);

  const handleOpenApp = () => {
    if (intentUrl) {
      window.location.href = intentUrl;
    } else {
      window.location.href = `${scheme}://home`;
    }
  };

  if (!isAndroid || !isVisible) {
    return null;
  }

  const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 animate-in slide-in-from-bottom-4">
      <div className="mx-auto max-w-md rounded-lg border border-blue-100 bg-gradient-to-b from-white to-blue-50 p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="flex-1 text-lg font-bold text-gray-900">
            Ouvrez OchoApp
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-2 mb-4 text-center">
          <AppLogo size={40} />
          <p className="text-sm text-gray-600">
            Profitez d'une meilleure expérience sur OchoApp mobile avec des
            fonctionnalités exclusives.
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleOpenApp}
            className="flex w-full items-center justify-center gap-2 bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <AppLogo size={24} logo="LOGO" />
            <span>Ouvrir dans l'application</span>
          </Button>

          <Button
            onClick={() => window.open(playStoreUrl, "_blank")}
            className="flex w-full items-center justify-center gap-2 bg-gray-700 font-semibold text-white transition-colors hover:bg-gray-800"
          >
            <div className="flex h-5 w-5 items-center justify-center">
              <img
                src="/logos/playstore.svg"
                alt="Play Store"
                className="h-full w-full"
              />
            </div>
            <span>Télécharger sur Play Store</span>
          </Button>

          <Button
            onClick={() => setIsVisible(false)}
            variant="ghost"
            className="flex w-full items-center justify-center gap-2 text-gray-600 hover:bg-gray-100"
          >
            <Globe size={18} />
            <span>Rester sur le navigateur</span>
          </Button>
        </div>
      </div>
    </div>
  );
}