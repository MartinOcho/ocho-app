"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
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
  const playStoreUrl = "https://play.google.com/store/apps/details?id=com.ochokom.ochoapp";

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-[60] animate-in slide-in-from-bottom-4">
      <div className="max-w-md mx-auto bg-gradient-to-b from-white to-blue-50 rounded-lg shadow-lg p-6 border border-blue-100">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex-1">
            Ouvrez OchoApp
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bouton Rester sur le navigateur - en haut */}
        <div className="mb-4">
          <Button
            onClick={() => setIsVisible(false)}
            variant="outline"
            className="w-full text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400 transition-colors"
          >
            Rester sur le navigateur
          </Button>
        </div>

        {/* Contenu central avec logos */}
        <div className="flex gap-4 items-center flex-col mb-6">
          <div className="flex gap-3 items-center justify-center w-full">
            <div className="w-12 h-12 relative flex-shrink-0">
              <img 
                src="/logos/ochoapp-icon.svg" 
                alt="OchoApp" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-2xl font-bold text-gray-300">↓</div>
            <div className="w-12 h-12 relative flex-shrink-0">
              <img 
                src="/logos/playstore.svg" 
                alt="Play Store" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <p className="text-sm text-gray-600 text-center">
            Profitez d'une meilleure expérience sur OchoApp mobile avec des fonctionnalités exclusives.
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-3 flex-col">
          <Button
            onClick={() => window.open(deeplink)}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
          >
            <ExternalLink size={18} />
            <span>Ouvrir OchoApp</span>
          </Button>
          <Button
            onClick={() => window.open(playStoreUrl, "_blank")}
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <img 
                src="/logos/playstore.svg" 
                alt="Play Store" 
                className="w-full h-full"
              />
            </div>
            <span>Télécharger sur Play Store</span>
          </Button>
        </div>
      </div>
    </div>
  );
}