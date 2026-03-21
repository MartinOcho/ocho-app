"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppLogo from "./AppLogo";

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
  const downloadUrl = "/android/download";

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-[60] animate-in slide-in-from-bottom-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Ouvrez OchoApp mobile
            </h3>
            <div className="flex gap-2 items-center flex-col">
                <AppLogo size={40} />
                <p className="text-sm text-gray-600">
                Profitez d'une meilleure expérience sur OchoApp mobile avec des fonctionnalités exclusives.
                </p>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <Button
            onClick={() => window.open(deeplink)}
            className="flex items-center justify-center gap-2 flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ExternalLink size={20} />
            <span>Ouvrir</span>
          </Button>
          <Button
            onClick={() => window.open(downloadUrl, "_blank")}
            variant="outline"
            className="flex items-center justify-center gap-2 flex-1"
          >
            <Download size={20} />
            <span>Télécharger</span>
          </Button>
        </div>
      </div>
    </div>
  );
}