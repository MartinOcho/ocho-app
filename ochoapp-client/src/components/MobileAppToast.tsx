"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLogo from "./AppLogo";
import Image from "next/image";

export default function MobileAppToast() {
  const [isAndroid, setIsAndroid] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAndroidDevice = /Android/i.test(navigator.userAgent);
      if (isAndroidDevice) {
        setIsAndroid(true);
        setIsVisible(true);
      }
    }
  }, []);

  if (!isAndroid || !isVisible) {
    return null;
  }

  const deeplink = "ochoapp://home";
  const playStoreUrl =
    "https://play.google.com/store/apps/details?id=com.ochokom.ochoapp";

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
        <div className="flex flex-col items-center gap-2">
          <AppLogo size={40} />
          <p className="text-sm text-gray-600">
            Profitez d'une meilleure expérience sur OchoApp mobile avec des
            fonctionnalités exclusives.
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => window.open(deeplink)}
            className="flex w-full items-center justify-center gap-2 bg-primary-foreground font-semibold text-primary transition-colors hover:bg-primary-foreground/50"
          >
            <AppLogo size={40} logo="LOGO"/>
            <span>Ouvrir OchoApp</span>
          </Button>
          <Button
            onClick={() => window.open(playStoreUrl, "_blank")}
            className="flex w-full items-center justify-center gap-2 bg-green-600 font-semibold text-white transition-colors hover:bg-green-700"
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
            className="flex w-full items-center justify-center gap-2 bg-muted-foreground font-semibold text-muted transition-colors hover:bg-muted-foreground/50"
          >
            <Globe size={18} />
            <span>Rester sur le navigateur</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
